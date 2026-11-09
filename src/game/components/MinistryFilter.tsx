// A shared filter: a bar of ministry chips (with "all ministries" first) and a free-text search. Used on the screens that list things by ministry.
import { translate } from '../../shared/i18n/contentTranslator';
import { getLang } from '../../shared/i18n';

export interface FilterMinistry { id: string; name: string; icon: string }

/** Does the query appear in any of the texts? It matches the Hebrew source and, in another language, the translated text too. */
export function matchesQuery(query: string, ...texts: (string | undefined)[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const lang = getLang();
  return texts.some((t) => !!t && (t.toLowerCase().includes(q) || (lang !== 'he' && (translate(t, lang) ?? '').toLowerCase().includes(q))));
}

interface Props {
  ministries: FilterMinistry[];
  value?: string;
  onChange?: (id: string) => void;
  /** without a query the search box is not shown */
  query?: string;
  onQuery?: (q: string) => void;
  /** offer "all ministries" as the first chip */
  allowAll?: boolean;
  placeholder?: string;
  /** how many results the filter gives, shown next to the search */
  count?: number;
}

export function MinistryFilter({ ministries, value = '', onChange = () => {}, query, onQuery, allowAll = true, placeholder = 'חיפוש חופשי…', count }: Props) {
  return (
    <div className="minfilter" role="group" aria-label="סינון לפי משרד וחיפוש">
      {onQuery && (
        <div className="minfilter-search">
          <input type="search" aria-label="חיפוש חופשי" placeholder={`🔍 ${placeholder}`} value={query ?? ''} onChange={(e) => onQuery(e.target.value)} />
          {count !== undefined && <span className="text-xs muted shrink-0">{`${count} תוצאות`}</span>}
        </div>
      )}
      {(ministries.length > 1 || allowAll) && (
        <div className="minfilter-chips">
          {allowAll && <button type="button" className="minchip minchip-all" aria-pressed={value === ''} onClick={() => onChange('')}>🏛️ כל המשרדים</button>}
          {ministries.map((m) => <button key={m.id} type="button" className="minchip" aria-pressed={value === m.id} onClick={() => onChange(m.id)}>{`${m.icon} ${m.name}`}</button>)}
        </div>
      )}
    </div>
  );
}
