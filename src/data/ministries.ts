import type { BudgetCategory, Domain, ServiceId } from '../types/game';

export interface MinistryDef {
  id: string; name: string; icon: string; domain: Domain; services: ServiceId[]; categories: BudgetCategory[];
  deep: boolean; satire?: boolean; initialParty: string; quip: string;
}

export const MINISTRIES: MinistryDef[] = [
  { id: 'finance', name: 'משרד האוצר', icon: '💰', domain: 'finance', services: [], categories: [], deep: true, initialParty: 'givaa', quip: 'אין כסף. יש רק לחברים.' },
  { id: 'defense', name: 'משרד הביטחון', icon: '🛡️', domain: 'defense', services: ['security'], categories: ['defense'], deep: true, initialParty: 'kise', quip: 'כל קיצוץ הוא איום אסטרטגי.' },
  { id: 'education', name: 'משרד החינוך', icon: '🎓', domain: 'education', services: ['education'], categories: ['education'], deep: true, initialParty: 'kise', quip: 'רפורמה חדשה בכל ספטמבר.' },
  { id: 'health', name: 'משרד הבריאות', icon: '🏥', domain: 'health', services: ['health'], categories: ['health'], deep: true, initialParty: 'kise', quip: 'תור לרופא? יש לנו תור לתור.' },
  { id: 'transport', name: 'משרד התחבורה', icon: '🚆', domain: 'transport', services: ['transport'], categories: ['transport'], deep: true, initialParty: 'kise', quip: 'הפקקים הם מצב תודעתי.' },
  { id: 'housing', name: 'משרד הבינוי והשיכון', icon: '🏗️', domain: 'housing', services: ['housing'], categories: ['housing'], deep: true, initialParty: 'kugel', quip: 'בונים. בעיקר הבטחות.' },
  { id: 'welfare', name: 'משרד הרווחה', icon: '🤝', domain: 'welfare', services: ['welfare'], categories: ['welfare'], deep: true, initialParty: 'kugel', quip: 'מטפלים בכולם, חוץ מבפקידים.' },
  { id: 'interior', name: 'משרד הפנים', icon: '🪪', domain: 'interior', services: ['govServices'], categories: ['government'], deep: true, initialParty: 'kugel', quip: 'טופס 17 ב׳ בשלושה עותקים.' },
  { id: 'police', name: 'המשרד לביטחון פנים', icon: '🚓', domain: 'law', services: ['security'], categories: ['police'], deep: true, initialParty: 'beitenu', quip: 'שוטר לכל צומת (בתוכנית).' },
  { id: 'energy', name: 'משרד האנרגיה', icon: '⚡', domain: 'energy', services: ['energy'], categories: ['energy'], deep: true, initialParty: 'beitenu', quip: 'האור בקצה המנהרה הוא גנרטור.' },
  { id: 'infrastructure', name: 'משרד התשתיות הלאומיות', icon: '🚧', domain: 'infrastructure', services: ['infrastructure'], categories: ['infrastructure'], deep: false, initialParty: 'kise', quip: 'חופרים. ממלאים. חופרים שוב.' },
  { id: 'agriculture', name: 'משרד החקלאות', icon: '🌾', domain: 'agriculture', services: [], categories: ['agriculture'], deep: false, initialParty: 'givaa', quip: 'מגדלים עגבניות ומחלוקות.' },
  { id: 'science', name: 'משרד המדע והחדשנות', icon: '🔬', domain: 'science', services: [], categories: ['science'], deep: false, initialParty: 'kise', quip: 'אפליקציה לכל בעיה, בעיה לכל אפליקציה.' },
  { id: 'culture', name: 'משרד התרבות והספורט', icon: '🎭', domain: 'culture', services: [], categories: ['culture'], deep: false, initialParty: 'kise', quip: 'גזרנו סרט. גם את התקציב.' },
  { id: 'economy', name: 'משרד הכלכלה', icon: '📈', domain: 'economy', services: [], categories: [], deep: false, initialParty: 'kise', quip: 'משרד שמטפל בכלכלה שהאוצר מנהל.' },
  { id: 'foreign', name: 'משרד החוץ', icon: '🌍', domain: 'foreign', services: [], categories: [], deep: false, initialParty: 'kise', quip: 'מפיצים הסברה בכל שפה, חוץ מאנגלית.' },
  { id: 'justice', name: 'משרד המשפטים', icon: '⚖️', domain: 'law', services: [], categories: [], deep: false, initialParty: 'kise', quip: 'החוק הוא חוק. בערך.' },
  { id: 'strategic', name: 'המשרד לנושאים אסטרטגיים כלליים', icon: '🌀', domain: 'management', services: [], categories: [], deep: false, satire: true, initialParty: 'kugel', quip: 'אף אחד לא יודע מה עושים פה. גם השר.' },
];

/** Templates for ministries the PM can create. */
export const NEW_MINISTRY_TEMPLATES: { id: string; name: string; icon: string; domain: Domain; satire?: boolean }[] = [
  { id: 'innovation', name: 'המשרד לחדשנות וטכנולוגיה', icon: '🤖', domain: 'science' },
  { id: 'periphery', name: 'המשרד לפיתוח הפריפריה', icon: '🏜️', domain: 'infrastructure' },
  { id: 'happiness', name: 'המשרד לשמחה לאומית', icon: '😁', domain: 'culture', satire: true },
  { id: 'hasbara', name: 'המשרד להסברה ותדמית', icon: '📣', domain: 'media', satire: true },
  { id: 'jerusalem_affairs', name: 'המשרד לענייני ירושלמה וקצת מסורת', icon: '🕍', domain: 'interior' },
];

export const DOMAIN_NAMES: Record<Domain, string> = {
  economy: 'כלכלה', finance: 'אוצר', defense: 'ביטחון', education: 'חינוך', health: 'בריאות', transport: 'תחבורה',
  law: 'משפט ואכיפה', foreign: 'חוץ', infrastructure: 'תשתיות', management: 'ניהול', welfare: 'רווחה', energy: 'אנרגיה',
  agriculture: 'חקלאות', interior: 'פנים', media: 'תקשורת', housing: 'דיור', science: 'מדע', culture: 'תרבות',
};
