import EditorShell from "@/components/engine/editor/EditorShell";

export default async function EditorPage(
  props: { params: Promise<{ postId: string }> }
) {
  const { postId } = await props.params;

  return <EditorShell postId={postId} />;
}
