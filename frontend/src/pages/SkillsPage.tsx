import { useEffect, useState, useCallback } from 'react';
import {
  Package, Shield, ShieldAlert, ShieldCheck, ShieldX,
  Download, Trash2, Search, RefreshCw, Loader2, AlertTriangle,
  Zap, HardDrive, Globe, ChevronDown, ChevronUp, Tag,
} from 'lucide-react';
import { getBase } from '../lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InstalledSkill {
  name: string;
  version: string;
  description: string;
  author: string;
  tags: string[];
  capabilities: string[];
  dangerous_capabilities: string[];
  steps: number;
}

interface SearchResult {
  source: string;
  name: string;
  category: string;
  description: string;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchInstalledSkills(): Promise<InstalledSkill[]> {
  const res = await fetch(`${getBase()}/v1/skills`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.skills || [];
}

async function searchSkills(query: string): Promise<SearchResult[]> {
  const res = await fetch(`${getBase()}/v1/skills/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.results || [];
}

async function installSkill(source: string, name: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${getBase()}/v1/skills/install`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, name }),
  });
  const data = await res.json();
  return data;
}

async function removeSkill(name: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${getBase()}/v1/skills/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  return data;
}

// ---------------------------------------------------------------------------
// Security badge
// ---------------------------------------------------------------------------

function SecurityBadge({ dangerous }: { dangerous: string[] }) {
  if (dangerous.length === 0) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
        style={{ background: 'var(--color-success, #22c55e)20', color: 'var(--color-success, #22c55e)' }}
      >
        <ShieldCheck size={11} /> SAFE
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
      style={{ background: 'var(--color-error, #ef4444)20', color: 'var(--color-error, #ef4444)' }}
    >
      <ShieldAlert size={11} /> {dangerous.length} DANGEROUS
    </span>
  );
}

// ---------------------------------------------------------------------------
// Capability chip
// ---------------------------------------------------------------------------

function CapabilityChip({ cap, dangerous }: { cap: string; dangerous: boolean }) {
  const icons: Record<string, typeof Zap> = {
    'shell:execute': Zap,
    'filesystem:write': HardDrive,
    'network:listen': Globe,
  };
  const Icon = icons[cap] || Tag;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px]"
      style={{
        background: dangerous ? 'var(--color-error, #ef4444)15' : 'var(--color-bg-tertiary)',
        color: dangerous ? 'var(--color-error, #ef4444)' : 'var(--color-text-secondary)',
        border: dangerous ? '1px solid var(--color-error, #ef4444)30' : '1px solid var(--color-border)',
      }}
    >
      <Icon size={10} /> {cap}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Skill card
// ---------------------------------------------------------------------------

function SkillCard({ skill, onRemove }: { skill: InstalledSkill; onRemove: (name: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [removing, setRemoving] = useState(false);

  const handleRemove = async () => {
    if (!confirm(`Skill "${skill.name}" wirklich entfernen?`)) return;
    setRemoving(true);
    await removeSkill(skill.name);
    onRemove(skill.name);
  };

  return (
    <div
      className="rounded-xl p-4 transition-all"
      style={{
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{
              background: skill.dangerous_capabilities.length > 0
                ? 'var(--color-error, #ef4444)15'
                : 'var(--color-accent)15',
            }}
          >
            <Package
              size={20}
              style={{
                color: skill.dangerous_capabilities.length > 0
                  ? 'var(--color-error, #ef4444)'
                  : 'var(--color-accent)',
              }}
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>
                {skill.name}
              </span>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' }}
              >
                v{skill.version}
              </span>
              <SecurityBadge dangerous={skill.dangerous_capabilities} />
            </div>
            <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'var(--color-text-secondary)' }}>
              {skill.description || 'No description'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg transition-colors cursor-pointer"
            style={{ color: 'var(--color-text-tertiary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-tertiary)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            onClick={handleRemove}
            disabled={removing}
            className="p-1.5 rounded-lg transition-colors cursor-pointer"
            style={{ color: 'var(--color-text-tertiary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-error, #ef4444)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-tertiary)')}
          >
            {removing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
          {skill.author && (
            <div className="text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Author: {skill.author}
            </div>
          )}
          {skill.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {skill.tags.map((t) => (
                <span
                  key={t}
                  className="px-2 py-0.5 rounded-full text-[10px]"
                  style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}
                >
                  {t}
                </span>
              ))}
            </div>
          )}
          {skill.capabilities.length > 0 && (
            <div>
              <div className="text-[10px] font-medium mb-1" style={{ color: 'var(--color-text-tertiary)' }}>
                CAPABILITIES
              </div>
              <div className="flex flex-wrap gap-1">
                {skill.capabilities.map((cap) => (
                  <CapabilityChip
                    key={cap}
                    cap={cap}
                    dangerous={skill.dangerous_capabilities.includes(cap)}
                  />
                ))}
              </div>
            </div>
          )}
          {skill.steps > 0 && (
            <div className="text-xs mt-2" style={{ color: 'var(--color-text-tertiary)' }}>
              {skill.steps} step{skill.steps !== 1 ? 's' : ''} in pipeline
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Search result card
// ---------------------------------------------------------------------------

function SearchResultCard({
  result,
  installed,
  onInstall,
}: {
  result: SearchResult;
  installed: boolean;
  onInstall: (source: string, name: string) => Promise<void>;
}) {
  const [installing, setInstalling] = useState(false);

  const handleInstall = async () => {
    setInstalling(true);
    try {
      await onInstall(result.source, result.name);
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-lg px-4 py-3"
      style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>
            {result.name}
          </span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded"
            style={{ background: 'var(--color-accent)15', color: 'var(--color-accent)' }}
          >
            {result.source}
          </span>
          {result.category && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' }}
            >
              {result.category}
            </span>
          )}
        </div>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
          {result.description || 'No description'}
        </p>
      </div>
      <button
        onClick={handleInstall}
        disabled={installing || installed}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer shrink-0 transition-colors"
        style={{
          background: installed ? 'var(--color-bg-tertiary)' : 'var(--color-accent)',
          color: installed ? 'var(--color-text-tertiary)' : 'var(--color-on-accent)',
          opacity: installing ? 0.7 : 1,
        }}
      >
        {installing ? (
          <><Loader2 size={12} className="animate-spin" /> Installing...</>
        ) : installed ? (
          <><ShieldCheck size={12} /> Installed</>
        ) : (
          <><Download size={12} /> Install</>
        )}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function SkillsPage() {
  const [skills, setSkills] = useState<InstalledSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [tab, setTab] = useState<'installed' | 'search'>('installed');
  const [statusMsg, setStatusMsg] = useState('');

  const loadSkills = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchInstalledSkills();
      setSkills(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSkills(); }, [loadSkills]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchDone(false);
    try {
      const results = await searchSkills(searchQuery);
      setSearchResults(results);
      setSearchDone(true);
      setTab('search');
    } finally {
      setSearching(false);
    }
  };

  const handleInstall = async (source: string, name: string) => {
    const result = await installSkill(source, name);
    if (result.success) {
      setStatusMsg(`${name} installed`);
      await loadSkills();
    } else {
      setStatusMsg(`Failed: ${result.message}`);
    }
    setTimeout(() => setStatusMsg(''), 4000);
  };

  const handleRemove = async (name: string) => {
    setSkills((prev) => prev.filter((s) => s.name !== name));
    setStatusMsg(`${name} removed`);
    setTimeout(() => setStatusMsg(''), 3000);
  };

  const installedNames = new Set(skills.map((s) => s.name));
  const safeCount = skills.filter((s) => s.dangerous_capabilities.length === 0).length;
  const dangerousCount = skills.filter((s) => s.dangerous_capabilities.length > 0).length;

  return (
    <div className="flex-1 overflow-y-auto px-6 py-10">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
              <Shield size={22} style={{ color: 'var(--color-accent)' }} />
              Skills
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              Install and manage skills from Hermes, OpenClaw, and GitHub.
            </p>
          </div>
          <button
            onClick={loadSkills}
            disabled={loading}
            className="p-2 rounded-lg transition-colors cursor-pointer"
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-secondary)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div
            className="rounded-xl p-3 text-center"
            style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
          >
            <div className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{skills.length}</div>
            <div className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Installed</div>
          </div>
          <div
            className="rounded-xl p-3 text-center"
            style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
          >
            <div className="text-2xl font-bold" style={{ color: 'var(--color-success, #22c55e)' }}>{safeCount}</div>
            <div className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Safe</div>
          </div>
          <div
            className="rounded-xl p-3 text-center"
            style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
          >
            <div className="text-2xl font-bold" style={{ color: dangerousCount > 0 ? 'var(--color-error, #ef4444)' : 'var(--color-text-tertiary)' }}>
              {dangerousCount}
            </div>
            <div className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Dangerous</div>
          </div>
        </div>

        {/* Search bar */}
        <div className="flex gap-2 mb-4">
          <div
            className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
          >
            <Search size={14} style={{ color: 'var(--color-text-tertiary)' }} />
            <input
              type="text"
              placeholder="Search skills across Hermes, OpenClaw..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: 'var(--color-text)' }}
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching || !searchQuery.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors"
            style={{
              background: 'var(--color-accent)',
              color: 'var(--color-on-accent)',
              opacity: searching || !searchQuery.trim() ? 0.6 : 1,
            }}
          >
            {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Search
          </button>
        </div>

        {/* Status message */}
        {statusMsg && (
          <div
            className="mb-4 px-4 py-2 rounded-lg text-sm"
            style={{
              background: statusMsg.startsWith('Failed') ? 'var(--color-error, #ef4444)15' : 'var(--color-success, #22c55e)15',
              color: statusMsg.startsWith('Failed') ? 'var(--color-error, #ef4444)' : 'var(--color-success, #22c55e)',
              border: `1px solid ${statusMsg.startsWith('Failed') ? 'var(--color-error, #ef4444)30' : 'var(--color-success, #22c55e)30'}`,
            }}
          >
            {statusMsg}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-4 p-1 rounded-lg" style={{ background: 'var(--color-bg-secondary)' }}>
          <button
            onClick={() => setTab('installed')}
            className="flex-1 px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer transition-colors"
            style={{
              background: tab === 'installed' ? 'var(--color-bg)' : 'transparent',
              color: tab === 'installed' ? 'var(--color-text)' : 'var(--color-text-tertiary)',
              boxShadow: tab === 'installed' ? '0 1px 2px rgba(0,0,0,.1)' : 'none',
            }}
          >
            <Package size={13} className="inline mr-1.5" style={{ verticalAlign: '-2px' }} />
            Installed ({skills.length})
          </button>
          <button
            onClick={() => setTab('search')}
            className="flex-1 px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer transition-colors"
            style={{
              background: tab === 'search' ? 'var(--color-bg)' : 'transparent',
              color: tab === 'search' ? 'var(--color-text)' : 'var(--color-text-tertiary)',
              boxShadow: tab === 'search' ? '0 1px 2px rgba(0,0,0,.1)' : 'none',
            }}
          >
            <Search size={13} className="inline mr-1.5" style={{ verticalAlign: '-2px' }} />
            Search Results {searchResults.length > 0 && `(${searchResults.length})`}
          </button>
        </div>

        {/* Content */}
        {tab === 'installed' && (
          <div className="flex flex-col gap-3">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
              </div>
            ) : skills.length === 0 ? (
              <div className="text-center py-12">
                <Package size={40} className="mx-auto mb-3" style={{ color: 'var(--color-text-tertiary)' }} />
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  No skills installed yet. Search to find and install skills.
                </p>
              </div>
            ) : (
              skills.map((skill) => (
                <SkillCard key={skill.name} skill={skill} onRemove={handleRemove} />
              ))
            )}
          </div>
        )}

        {tab === 'search' && (
          <div className="flex flex-col gap-2">
            {!searchDone ? (
              <div className="text-center py-12">
                <Search size={40} className="mx-auto mb-3" style={{ color: 'var(--color-text-tertiary)' }} />
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  Search for skills across configured sources.
                </p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  No results for "{searchQuery}"
                </p>
              </div>
            ) : (
              searchResults.map((r) => (
                <SearchResultCard
                  key={`${r.source}:${r.name}`}
                  result={r}
                  installed={installedNames.has(r.name)}
                  onInstall={handleInstall}
                />
              ))
            )}
          </div>
        )}

        {/* Security info */}
        {dangerousCount > 0 && (
          <div
            className="mt-6 rounded-xl p-4 flex items-start gap-3"
            style={{
              background: 'var(--color-error, #ef4444)08',
              border: '1px solid var(--color-error, #ef4444)20',
            }}
          >
            <AlertTriangle size={18} className="shrink-0 mt-0.5" style={{ color: 'var(--color-error, #ef4444)' }} />
            <div>
              <div className="text-sm font-medium" style={{ color: 'var(--color-error, #ef4444)' }}>
                {dangerousCount} skill{dangerousCount !== 1 ? 's' : ''} with dangerous capabilities
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                These skills have access to shell execution, filesystem writes, or network listeners.
                Review them carefully and remove any you don't trust.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
