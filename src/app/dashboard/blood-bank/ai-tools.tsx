
'use client';

import { AIForms } from "./ai-forms";

export function AITools({ onSave }: { onSave: () => void }) {
    return <AIForms onSave={onSave} />;
}
