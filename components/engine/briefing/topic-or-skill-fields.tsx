'use client';

import { Input } from '@/components/ui/input';
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
  if (isTopicMode) {
    return (
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1">
          Topic
        </label>
        <Input
          type="text"
          placeholder="Ex: Delirium, Righteous Fire, Harvest Crafting"
          value={form.topic || ''}
          onChange={(e) => updateField('topic', e.target.value)}
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
        <Input
          type="text"
          placeholder="Ex: Righteous Fire"
          value={form.skill}
          onChange={(e) => updateField('skill', e.target.value)}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1">
          Ascendancy
        </label>
        <Input
          type="text"
          placeholder="Ex: Chieftain"
          value={form.ascendancy}
          onChange={(e) => updateField('ascendancy', e.target.value)}
        />
      </div>
    </div>
  );
}
