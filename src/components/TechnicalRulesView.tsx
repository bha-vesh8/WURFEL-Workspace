import React, { useState } from 'react';
import { Check, Edit2, Save, ShieldCheck, Sliders } from 'lucide-react';
import { FindingSeverity, TechnicalRule } from '../types.ts';

interface TechnicalRulesViewProps {
  rules: TechnicalRule[];
  onUpdateRule: (ruleId: string, updates: Partial<TechnicalRule>) => Promise<void>;
}

const RULE_GROUPS: TechnicalRule['groupName'][] = [
  'Measurements',
  'Dimensions and clearances',
  'Finishes',
  'Hardware',
  'Accessories',
  'Lighting',
  'Mechanisms',
  'Technical feasibility',
  'Costing',
  'Missing information',
];

export const TechnicalRulesView: React.FC<TechnicalRulesViewProps> = ({ rules, onUpdateRule }) => {
  const [selectedGroup, setSelectedGroup] = useState<string>('All');
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [thresholdDraft, setThresholdDraft] = useState<string>('');
  const [severityDraft, setSeverityDraft] = useState<FindingSeverity>('High');
  const [authorityDraft, setAuthorityDraft] = useState<string>('');
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  const filteredRules =
    selectedGroup === 'All' ? rules : rules.filter((r) => r.groupName === selectedGroup);

  const startEdit = (r: TechnicalRule) => {
    setEditingRuleId(r.id);
    setThresholdDraft(r.thresholdValue || '');
    setSeverityDraft(r.severity);
    setAuthorityDraft(r.authorityReference);
  };

  const handleSaveEdit = async (ruleId: string) => {
    await onUpdateRule(ruleId, {
      thresholdValue: thresholdDraft,
      severity: severityDraft,
      authorityReference: authorityDraft,
    });
    setEditingRuleId(null);
    setSavedBanner('Rule configuration saved. Subsequent analysis runs will use the updated threshold and severity.');
    setTimeout(() => setSavedBanner(null), 3500);
  };

  const handleToggleRule = async (r: TechnicalRule) => {
    await onUpdateRule(r.id, { enabled: !r.enabled });
    setSavedBanner(`Rule ${r.ruleCode} ${!r.enabled ? 'enabled' : 'disabled'} for future analysis runs.`);
    setTimeout(() => setSavedBanner(null), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Technical Validation Rules</h1>
          <p className="mt-1 text-sm text-slate-600">
            Configure deterministic thresholds, severities, and enabled rules evaluated during dossier analysis.
          </p>
        </div>
        <div className="text-xs text-slate-500">
          Active Rules:{' '}
          <span className="font-mono font-semibold text-slate-900 tabular-nums">
            {rules.filter((r) => r.enabled).length} / {rules.length}
          </span>
        </div>
      </div>

      {/* Honest Provenance Explanation */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
        <span className="font-semibold text-slate-900">Rule Provenance Classification: </span>
        WURFEL clearly distinguishes between{' '}
        <span className="font-medium text-blue-700">Built-in Prototype Rules</span> (cross-document parity & arithmetic checks),{' '}
        <span className="font-medium text-emerald-700">Client-Configured Rules</span> (workshop tolerances & clearances), and{' '}
        <span className="font-medium text-purple-700">Supplied Reference Standards</span>. Sample thresholds are illustrative examples and are immediately applied by the analysis engine when enabled.
      </div>

      {savedBanner && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-900">
          <Check className="h-4 w-4 text-emerald-600" />
          <span>{savedBanner}</span>
        </div>
      )}

      {/* Group Filter Bar */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-2">
        <button
          type="button"
          onClick={() => setSelectedGroup('All')}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
            selectedGroup === 'All' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          All Groups ({rules.length})
        </button>
        {RULE_GROUPS.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setSelectedGroup(g)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
              selectedGroup === g ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Rules Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <th className="px-4 py-3 font-semibold">Enabled</th>
              <th className="px-4 py-3 font-semibold">Rule Code & Name</th>
              <th className="px-4 py-3 font-semibold">Group</th>
              <th className="px-4 py-3 font-semibold">Source / Authority</th>
              <th className="px-4 py-3 font-semibold">Threshold</th>
              <th className="px-4 py-3 font-semibold">Severity</th>
              <th className="px-4 py-3 text-right font-semibold">Configure</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredRules.map((r) => {
              const isEditing = editingRuleId === r.id;
              return (
                <tr key={r.id} className={!r.enabled ? 'bg-slate-50/60 opacity-65' : 'hover:bg-slate-50/80'}>
                  <td className="px-4 py-4 align-top">
                    <input
                      type="checkbox"
                      checked={r.enabled}
                      onChange={() => handleToggleRule(r)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900">{r.ruleCode}</span>
                      <span className="font-semibold text-slate-900">{r.name}</span>
                    </div>
                    <p className="mt-1 max-w-xl text-slate-600 leading-relaxed">{r.description}</p>
                  </td>
                  <td className="px-4 py-4 align-top text-slate-700 whitespace-nowrap">{r.groupName}</td>
                  <td className="px-4 py-4 align-top">
                    <div
                      className={`font-medium ${
                        r.sourceType === 'Built-in Prototype Rule'
                          ? 'text-blue-700'
                          : r.sourceType === 'Client-Configured Rule'
                          ? 'text-emerald-700'
                          : 'text-purple-700'
                      }`}
                    >
                      {r.sourceType}
                    </div>
                    {isEditing ? (
                      <input
                        type="text"
                        value={authorityDraft}
                        onChange={(e) => setAuthorityDraft(e.target.value)}
                        className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                      />
                    ) : (
                      <div className="mt-0.5 text-[11px] text-slate-500">{r.authorityReference}</div>
                    )}
                  </td>
                  <td className="px-4 py-4 align-top font-mono tabular-nums whitespace-nowrap">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={thresholdDraft}
                          onChange={(e) => setThresholdDraft(e.target.value)}
                          className="w-20 rounded border border-slate-300 px-2 py-1 font-mono text-xs"
                        />
                        <span className="text-slate-500">{r.unit}</span>
                      </div>
                    ) : (
                      <span className="font-semibold text-slate-900">
                        {r.comparisonOperator} {r.thresholdValue} {r.unit}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 align-top whitespace-nowrap">
                    {isEditing ? (
                      <select
                        value={severityDraft}
                        onChange={(e) => setSeverityDraft(e.target.value as FindingSeverity)}
                        className="rounded border border-slate-300 px-2 py-1 text-xs"
                      >
                        <option value="Critical">Critical</option>
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    ) : (
                      <span
                        className={`font-semibold ${
                          r.severity === 'Critical'
                            ? 'text-red-600'
                            : r.severity === 'High'
                            ? 'text-amber-700'
                            : 'text-blue-700'
                        }`}
                      >
                        {r.severity}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 align-top text-right whitespace-nowrap">
                    {isEditing ? (
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(r.id)}
                          className="inline-flex items-center gap-1 rounded bg-blue-600 px-2.5 py-1 font-semibold text-white hover:bg-blue-700"
                        >
                          <Save className="h-3 w-3" />
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingRuleId(null)}
                          className="text-slate-500 hover:text-slate-800"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEdit(r)}
                        className="inline-flex items-center gap-1 font-medium text-blue-600 hover:text-blue-800"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        Edit Value
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
