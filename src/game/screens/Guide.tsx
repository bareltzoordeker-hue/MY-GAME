// The actions guide: every action in the game, generated from the game's own action definitions, with a search and a filter by role.
import { useMemo, useState } from 'react';
import { useGame } from '../store/gameStore';
import { ACTIONS, ministryActionSpecs } from '../../engine/decisions';
import { CATEGORY_LABEL, GUIDE_FEATURES, GUIDE_ROLES, actionRoles, type GuideRole } from '../../data/actionGuide';
import { isForeignMinister, isEconomyMinister, isPM, isPartyLeader, isSpeaker } from '../../engine/roles';
import { securityRole } from '../../engine/security';
import type { GameState } from '../../types/game';
import { matchesQuery } from '../components/MinistryFilter';
import { ScreenHeader, Section } from '../components/ui';

/** The roles the player holds now (a minister may also be the defense, foreign or economy minister). */
export function myGuideRoles(s: GameState): GuideRole[] {
  const r: GuideRole[] = [];
  if (isPM(s)) r.push('pm');
  if (s.player.role === 'minister') r.push('minister');
  const sec = securityRole(s);
  if (sec === 'defense') r.push('defense');
  if (sec === 'internal') r.push('internal');
  if (isForeignMinister(s)) r.push('foreign');
  if (isEconomyMinister(s)) r.push('economy');
  if (isPartyLeader(s)) r.push('leader');
  if (isSpeaker(s)) r.push('speaker');
  if (!r.length || s.player.role === 'mk') r.push('mk');
  return r;
}

interface Row { key: string; icon: string; title: string; desc: string; group: string; roles: GuideRole[]; meta: string[] }

export function GuideScreen() {
  const s = useGame((x) => x.game)!;
  const mine = useMemo(() => myGuideRoles(s), [s.player.role, s.government.pmId, s.player.politicianId]); // eslint-disable-line react-hooks/exhaustive-deps
  const [role, setRole] = useState<GuideRole | 'mine' | 'all'>('mine');
  const [q, setQ] = useState('');
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const f of GUIDE_FEATURES) out.push({ key: `f_${f.id}`, icon: f.icon, title: f.title, desc: f.desc, group: 'אפשרויות ומסכים', roles: f.roles, meta: [`📍 ${f.where}`] });
    for (const a of Object.values(ACTIONS)) {
      const meta: string[] = [];
      if (typeof a.capital === 'number') meta.push(`🎯 הון: ${a.capital}`); else if (a.capital) meta.push('🎯 הון: משתנה');
      if (a.cooldown) meta.push(a.cooldown === 1 ? '⏳ המתנה: תור אחד' : `⏳ המתנה: ${a.cooldown} תורות`);
      out.push({ key: a.id, icon: a.icon, title: a.title, desc: a.description, group: CATEGORY_LABEL[a.category], roles: actionRoles(a.id, a.category), meta });
    }
    const seen = new Set<string>();
    for (const m of s.government.ministries) {
      for (const a of ministryActionSpecs(m)) {
        const key = `m_${m.id}_${a.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const meta = [`🏛️ ${m.name}`, `🎯 הון: ${a.capital}`];
        out.push({ key, icon: a.icon, title: a.title, desc: a.desc, group: CATEGORY_LABEL.ministry_special, roles: ['minister', 'defense', 'foreign', 'economy', 'internal', 'pm'], meta });
      }
    }
    return out;
  }, [s.government.ministries]);
  const active = role === 'all' ? null : role === 'mine' ? mine : [role];
  const shown = rows.filter((r) => (!active || r.roles.some((x) => active.includes(x))) && matchesQuery(q, r.title, r.desc, r.group, ...r.meta));
  const groups = [...new Set(shown.map((r) => r.group))];
  return (
    <div className="space-y-4">
      <ScreenHeader title="מדריך הפעולות" sub="כל מה שאפשר לעשות במשחק, לפי תפקיד. הרשימה נבנית מהפעולות עצמן, ולכן היא תמיד מעודכנת." />
      <div className="minfilter" role="group" aria-label="סינון לפי תפקיד וחיפוש">
        <div className="minfilter-search">
          <input type="search" aria-label="חיפוש חופשי" placeholder="🔍 חיפוש פעולה, מבצע או נושא…" value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="text-xs muted shrink-0">{`${shown.length} תוצאות`}</span>
        </div>
        <div className="minfilter-chips">
          <button type="button" className="minchip minchip-all" aria-pressed={role === 'mine'} onClick={() => setRole('mine')}>⭐ התפקיד שלי</button>
          <button type="button" className="minchip" aria-pressed={role === 'all'} onClick={() => setRole('all')}>📚 כל התפקידים</button>
          {GUIDE_ROLES.map((r) => <button key={r.id} type="button" className="minchip" aria-pressed={role === r.id} onClick={() => setRole(r.id)}>{`${r.icon} ${r.label}`}</button>)}
        </div>
      </div>
      {!shown.length && <div className="card text-sm muted">לא נמצאו פעולות שמתאימות לחיפוש.</div>}
      {groups.map((g) => (
        <Section key={g} title={g} icon="📖">
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-2">
            {shown.filter((r) => r.group === g).map((r) => (
              <div key={r.key} className="inset flex flex-col gap-1">
                <b className="text-sm">{`${r.icon} ${r.title}`}</b>
                <span className="text-xs muted flex-1">{r.desc}</span>
                {r.meta.length > 0 && <span className="text-[11px] muted">{r.meta.join(' · ')}</span>}
                <span className="flex flex-wrap gap-1">{r.roles.length >= 8 ? <span className="chip">כולם</span> : r.roles.map((x) => <span key={x} className="chip">{GUIDE_ROLES.find((y) => y.id === x)?.label}</span>)}</span>
              </div>
            ))}
          </div>
        </Section>
      ))}
    </div>
  );
}
