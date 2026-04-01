"""
DreamPoeBot Monitor - Agente
Roda em cada PC que tem instancias do DreamPoeBot
Monitora os arquivos de log e envia para o servidor central
Cada arquivo de log = uma instancia separada no servidor
"""
import asyncio
import hashlib
import json
import os
import sys
import re
import socket
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict
import argparse

import aiohttp
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler


# Configuracoes do agente
class AgentConfig:
    SERVER_URL: str = "ws://localhost:8766/ws/agent"
    RECONNECT_DELAY: int = 5
    HEARTBEAT_INTERVAL: int = 30
    BATCH_SIZE: int = 50
    BATCH_INTERVAL: float = 0.5


# Regex para extrair informacoes do nome do arquivo e conteudo
# Formato do nome: "DreamPoeBot 39324 2026-03-17 00.36.txt"
FILENAME_PATTERN = re.compile(r'DreamPoeBot\s+(\d+)')
CONFIG_PATTERN = re.compile(r'--config:(\w+)')
VERSION_PATTERN = re.compile(r'DreamPoeBot Version: ([\d.]+)')


class BotInstance:
    """Representa uma instancia de bot (um arquivo de log)"""

    def __init__(self, filepath: str, pc_name: str):
        self.filepath = filepath
        self.filename = Path(filepath).name
        self.pc_name = pc_name

        # Extrair PID do nome do arquivo
        pid_match = FILENAME_PATTERN.search(self.filename)
        self.pid = int(pid_match.group(1)) if pid_match else None

        # ID deterministico baseado no PC + filepath
        id_hash = hashlib.sha256(f"{pc_name}:{filepath}".encode()).hexdigest()[:12]
        self.instance_id = f"{pc_name}-{id_hash}"

        # Info extraida dos logs
        self.config_name: Optional[str] = None
        self.bot_version: Optional[str] = None
        self.character_name: Optional[str] = None
        self.registered = False

    def extract_info(self, lines: List[str]):
        """Extrai config name, versao e character name do conteudo do log"""
        content = ''.join(lines)
        if not self.config_name:
            if match := CONFIG_PATTERN.search(content):
                self.config_name = match.group(1)
        if not self.bot_version:
            if match := VERSION_PATTERN.search(content):
                self.bot_version = match.group(1)
        if not self.character_name:
            char_match = re.search(
                r"(?:Selecting character: '([^']+)'|Setting character name to: (\S+))",
                content
            )
            if char_match:
                self.character_name = char_match.group(1) or char_match.group(2)


class LogFileHandler(FileSystemEventHandler):
    """Handler para mudancas em arquivos de log"""

    def __init__(self, agent: 'MonitorAgent'):
        self.agent = agent
        self.file_positions: Dict[str, int] = {}

    def on_modified(self, event):
        if event.is_directory:
            return
        path = Path(event.src_path)
        if not any(path.match(p) for p in self.agent.patterns):
            return
        asyncio.run_coroutine_threadsafe(
            self.process_file_change(event.src_path),
            self.agent.loop
        )

    def on_created(self, event):
        """Novo arquivo de log criado (novo bot iniciou)"""
        if event.is_directory:
            return
        path = Path(event.src_path)
        if not any(path.match(p) for p in self.agent.patterns):
            return
        print(f"[+] Novo arquivo detectado: {path.name}")
        self.file_positions[event.src_path] = 0
        asyncio.run_coroutine_threadsafe(
            self.process_file_change(event.src_path),
            self.agent.loop
        )

    async def process_file_change(self, filepath: str):
        """Processa mudancas em um arquivo de log"""
        try:
            current_pos = self.file_positions.get(filepath, 0)
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                f.seek(current_pos)
                new_lines = f.readlines()
                self.file_positions[filepath] = f.tell()
            if new_lines:
                await self.agent.queue_logs(filepath, new_lines)
        except Exception as e:
            print(f"[Erro ao processar {filepath}] {e}")

    def initialize_file(self, filepath: str):
        """Inicializa posicao de um arquivo (vai para o final) e extrai metadados"""
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                # Ler primeiras 100 linhas apenas para extrair config_name/version
                head = [f.readline() for _ in range(100)]
                f.seek(0, 2)
                self.file_positions[filepath] = f.tell()
            # Extrair info da instancia a partir do cabecalho
            instance = self.agent.get_or_create_instance(filepath)
            instance.extract_info(head)
            print(f"[+] Monitorando: {Path(filepath).name}" +
                  (f" [{instance.config_name}]" if instance.config_name else ""))
        except Exception as e:
            print(f"[Erro ao inicializar {filepath}] {e}")


class MonitorAgent:
    """Agente de monitoramento - 1 por PC, rastreia multiplos arquivos de log"""

    def __init__(self, server_url: str, log_directory: str, patterns: List[str] = None,
                 replay_file: str = None, max_age_minutes: int = 0):
        self.server_url = server_url
        self.log_directory = Path(log_directory)
        self.patterns = patterns or ["*.txt", "*.log"]
        self.replay_file = replay_file
        self.max_age_minutes = max_age_minutes  # 0 = sem filtro
        self.pc_name = socket.gethostname()

        self.ws: Optional[aiohttp.ClientWebSocketResponse] = None
        self.session: Optional[aiohttp.ClientSession] = None
        self.connected = False
        self.loop: asyncio.AbstractEventLoop = None

        # Instancias de bot: filepath -> BotInstance
        self.bot_instances: Dict[str, BotInstance] = {}

        # Fila de logs para enviar: filepath -> lines
        self.log_queue: Dict[str, List[str]] = {}

        # File watcher
        self.observer = Observer()
        self.handler = LogFileHandler(self)

    def get_or_create_instance(self, filepath: str) -> BotInstance:
        """Obtem ou cria uma instancia de bot para um arquivo"""
        if filepath not in self.bot_instances:
            instance = BotInstance(filepath, self.pc_name)
            self.bot_instances[filepath] = instance
            pid_str = f" (PID: {instance.pid})" if instance.pid else ""
            print(f"[+] Nova instancia: {Path(filepath).name}{pid_str}")
        return self.bot_instances[filepath]

    async def connect(self):
        """Conecta ao servidor central"""
        while True:
            try:
                if not self.session:
                    self.session = aiohttp.ClientSession()
                print(f"[*] Conectando a {self.server_url}...")
                self.ws = await self.session.ws_connect(self.server_url)
                self.connected = True
                print(f"[+] Conectado ao servidor!")

                # Re-registrar todas as instancias ativas no reconnect
                for instance in self.bot_instances.values():
                    if instance.registered:
                        await self.register_instance(instance)
                return
            except Exception as e:
                print(f"[!] Erro de conexao: {e}")
                print(f"[*] Tentando novamente em {AgentConfig.RECONNECT_DELAY}s...")
                await asyncio.sleep(AgentConfig.RECONNECT_DELAY)

    async def register_instance(self, instance: BotInstance):
        """Registra uma instancia de bot no servidor"""
        await self.send_message({
            "type": "register",
            "instance_id": instance.instance_id,
            "config_name": instance.config_name or "unknown",
            "pc_name": self.pc_name,
            "data": {
                "version": instance.bot_version,
                "character": instance.character_name,
                "log_file": instance.filename,
                "pid": instance.pid,
                "log_directory": str(self.log_directory)
            }
        })
        instance.registered = True
        pid_str = f" PID:{instance.pid}" if instance.pid else ""
        print(f"[+] Registrado: {instance.config_name or instance.filename}{pid_str} ({instance.instance_id})")

    async def send_message(self, message: dict):
        """Envia mensagem para o servidor"""
        if self.ws and not self.ws.closed:
            try:
                await self.ws.send_json(message)
            except Exception as e:
                print(f"[!] Erro ao enviar mensagem: {e}")
                self.connected = False

    async def queue_logs(self, filepath: str, lines: List[str]):
        """Adiciona logs a fila de envio e registra instancia se necessario"""
        instance = self.get_or_create_instance(filepath)
        instance.extract_info(lines)

        # Registrar no servidor se ainda nao foi
        if not instance.registered and self.connected:
            await self.register_instance(instance)

        if filepath not in self.log_queue:
            self.log_queue[filepath] = []
        self.log_queue[filepath].extend(lines)

    async def send_logs_task(self):
        """Task que envia logs em batches"""
        while True:
            try:
                if self.connected and self.log_queue:
                    for filepath, lines in list(self.log_queue.items()):
                        if not lines:
                            continue

                        instance = self.get_or_create_instance(filepath)
                        batch = lines[:AgentConfig.BATCH_SIZE]
                        self.log_queue[filepath] = lines[AgentConfig.BATCH_SIZE:]

                        if not self.log_queue[filepath]:
                            del self.log_queue[filepath]

                        await self.send_message({
                            "type": "logs",
                            "instance_id": instance.instance_id,
                            "config_name": instance.config_name or "unknown",
                            "pc_name": self.pc_name,
                            "data": {
                                "logs": [l.strip() for l in batch if l.strip()],
                                "filepath": filepath
                            }
                        })

                await asyncio.sleep(AgentConfig.BATCH_INTERVAL)
            except Exception as e:
                print(f"[!] Erro ao enviar logs: {e}")
                await asyncio.sleep(1)

    async def heartbeat_task(self):
        """Task que envia heartbeats para todas as instancias"""
        while True:
            try:
                if self.connected:
                    for instance in self.bot_instances.values():
                        if instance.registered:
                            await self.send_message({
                                "type": "heartbeat",
                                "instance_id": instance.instance_id,
                                "config_name": instance.config_name or "unknown",
                                "pc_name": self.pc_name
                            })
                await asyncio.sleep(AgentConfig.HEARTBEAT_INTERVAL)
            except Exception as e:
                print(f"[!] Erro no heartbeat: {e}")
                await asyncio.sleep(1)

    async def receive_task(self):
        """Task que recebe mensagens do servidor"""
        while True:
            try:
                if self.ws and not self.ws.closed:
                    async for msg in self.ws:
                        if msg.type == aiohttp.WSMsgType.TEXT:
                            data = json.loads(msg.data)
                            await self.handle_server_message(data)
                        elif msg.type in (aiohttp.WSMsgType.ERROR, aiohttp.WSMsgType.CLOSED):
                            break

                self.connected = False
                print("[!] Conexao perdida. Reconectando...")
                await self.connect()
            except Exception as e:
                print(f"[!] Erro ao receber mensagem: {e}")
                self.connected = False
                await asyncio.sleep(AgentConfig.RECONNECT_DELAY)

    async def handle_server_message(self, message: dict):
        """Processa mensagens recebidas do servidor"""
        pass

    def start_file_watcher(self):
        """Inicia monitoramento de arquivos"""
        if not self.log_directory.exists():
            print(f"[!] Diretorio nao encontrado: {self.log_directory}")
            return False

        # Inicializar arquivos existentes, filtrar por idade e deduplicar por config_name
        import time
        now = time.time()
        # Coletar arquivos candidatos ordenados do mais recente ao mais antigo
        candidates = []
        for pattern in self.patterns:
            for log_file in self.log_directory.glob(pattern):
                mtime = log_file.stat().st_mtime
                if self.max_age_minutes > 0:
                    if (now - mtime) / 60 > self.max_age_minutes:
                        continue
                candidates.append((mtime, log_file))
        candidates.sort(reverse=True)  # mais recente primeiro

        seen_configs = set()
        for mtime, log_file in candidates:
            self.handler.initialize_file(str(log_file))
            instance = self.bot_instances.get(str(log_file))
            if instance and instance.config_name:
                key = instance.config_name
                if key in seen_configs:
                    # Duplicata mais antiga — remover
                    del self.bot_instances[str(log_file)]
                    del self.handler.file_positions[str(log_file)]
                    print(f"[-] Ignorando duplicata: {log_file.name} (config: {key})")
                    continue
                seen_configs.add(key)

        self.observer.schedule(self.handler, str(self.log_directory), recursive=False)
        self.observer.start()
        print(f"[+] Monitorando diretorio: {self.log_directory}")
        print(f"[+] Patterns: {', '.join(self.patterns)}")
        print(f"[+] Arquivos encontrados: {len(self.bot_instances)}")
        return True

    async def replay_file_task(self, filepath: str):
        """Replay: le um arquivo existente do inicio e envia como se fosse tempo real"""
        print(f"[REPLAY] Enviando arquivo: {filepath}")
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                batch = []
                for line in f:
                    line = line.strip()
                    if line:
                        batch.append(line)
                    if len(batch) >= AgentConfig.BATCH_SIZE:
                        await self.queue_logs(filepath, batch)
                        batch = []
                        await asyncio.sleep(AgentConfig.BATCH_INTERVAL)
                if batch:
                    await self.queue_logs(filepath, batch)
            while self.log_queue:
                await asyncio.sleep(0.5)
            await asyncio.sleep(1)
            print(f"[REPLAY] Concluido! Arquivo enviado com sucesso.")
        except Exception as e:
            print(f"[REPLAY] Erro: {e}")

    async def run(self):
        """Executa o agente"""
        self.loop = asyncio.get_event_loop()

        # Conectar ao servidor
        await self.connect()

        # Modo replay: enviar arquivo existente e sair
        if self.replay_file:
            send_task = asyncio.create_task(self.send_logs_task())
            await self.replay_file_task(self.replay_file)
            send_task.cancel()
            if self.ws:
                await self.ws.close()
            if self.session:
                await self.session.close()
            return

        # Modo normal: monitorar diretorio
        if not self.start_file_watcher():
            print("[!] Falha ao iniciar monitoramento de arquivos")
            return

        # Registrar instancias existentes no servidor
        for instance in self.bot_instances.values():
            await self.register_instance(instance)

        tasks = [
            asyncio.create_task(self.send_logs_task()),
            asyncio.create_task(self.heartbeat_task()),
            asyncio.create_task(self.receive_task()),
        ]

        try:
            await asyncio.gather(*tasks)
        except KeyboardInterrupt:
            print("\n[*] Encerrando agente...")
        finally:
            self.observer.stop()
            self.observer.join()

            # Enviar disconnect para todas as instancias
            for instance in self.bot_instances.values():
                if instance.registered:
                    await self.send_message({
                        "type": "disconnect",
                        "instance_id": instance.instance_id,
                        "config_name": instance.config_name or "unknown",
                        "pc_name": self.pc_name
                    })

            if self.ws:
                await self.ws.close()
            if self.session:
                await self.session.close()


def main():
    arg_parser = argparse.ArgumentParser(description="DreamPoeBot Monitor Agent")
    arg_parser.add_argument(
        "--server", "-s",
        default="ws://localhost:8766/ws/agent",
        help="URL do servidor WebSocket (default: ws://localhost:8766/ws/agent)"
    )
    arg_parser.add_argument(
        "--logs", "-l",
        required=True,
        help="Diretorio dos logs do DreamPoeBot"
    )
    arg_parser.add_argument(
        "--pattern", "-p",
        action="append",
        help="Pattern de arquivos a monitorar (default: *.txt *.log). Pode repetir: -p '*.txt' -p '*.log'"
    )
    arg_parser.add_argument(
        "--replay",
        help="Modo teste: envia um arquivo de log existente do inicio ao fim e sai"
    )
    arg_parser.add_argument(
        "--max-age",
        type=int,
        default=0,
        dest="max_age",
        help="Ignorar arquivos nao modificados ha mais de N minutos (default: 0 = monitorar todos)"
    )

    args = arg_parser.parse_args()

    print("")
    print("  +==================================================+")
    print("  |       DreamPoeBot Monitor - Agent v1.0.0          |")
    print("  +==================================================+")
    print("")
    print(f"[*] Servidor: {args.server}")
    print(f"[*] Diretorio de logs: {args.logs}")
    print(f"[*] PC: {socket.gethostname()}")
    if args.replay:
        print(f"[*] Modo: REPLAY ({args.replay})")
    print()

    agent = MonitorAgent(
        args.server,
        args.logs,
        patterns=args.pattern,
        replay_file=args.replay,
        max_age_minutes=args.max_age,
    )
    asyncio.run(agent.run())


if __name__ == "__main__":
    main()
