'use client';

import type { Briefing } from '@/lib/engine-types';

interface TopicOrSkillFieldsProps {
  form: Briefing;
  updateField: <K extends keyof Briefing>(key: K, value: Briefing[K]) => void;
  isTopicMode: boolean;
}

// Renders Topic input (topic-based templates) OR Skill+Ascendancy pair
// (build-guide templates). isTopicMode is derived from TOPIC_TEMPLATES in
// BriefingForm; passing it as prop avoids re-importing the constant.
export function TopicOrSkillFields({ form, updateField, isTopicMode }: TopicOrSkillFieldsProps) {
  const inputClass =
    'w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent';

  if (isTopicMode) {
    return (
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1">
          Topic
        </label>
        <input
          type="text"
          placeholder="Ex: Delirium, Righteous Fire, Harvest Crafting"
          value={form.topic || ''}
          onChange={(e) => updateField('topic', e.target.value)}
          className={inputClass}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1">
          Skill
        </label>
        <input
          type="text"
          placeholder="Ex: Righteous Fire"
          value={form.skill}
          onChange={(e) => updateField('skill', e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1">
          Ascendancy
        </label>
        <input
          type="text"
          placeholder="Ex: Chieftain"
          value={form.ascendancy}
          onChange={(e) => updateField('ascendancy', e.target.value)}
          className={inputClass}
        />
      </div>
    </div>
  );
}
