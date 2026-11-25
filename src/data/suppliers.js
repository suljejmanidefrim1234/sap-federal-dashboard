import solutions from './solutions.json';
import catalogue from './catalogue.json';
export const SUPPLIER_GROUPS = catalogue.groups;
export const TRACKED_SUPPLIERS = catalogue.suppliers;
export const normalizeText = value => String(value || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
const hasWords = (text, words) => (` ${text} `).includes(` ${normalizeText(words)} `);
export function classifyVendor(name) {
  const text = normalizeText(name);
  const supplier = TRACKED_SUPPLIERS.find(s => s.aliases.some(a => hasWords(text, a)));
  return supplier ? { ...SUPPLIER_GROUPS[supplier.group], ...supplier } : null;
}
export const SOLUTION_AREAS = solutions.areas;
// Only disclosed descriptions/comments supply area evidence; supplier names never do.
export function identifySolutionAreas(description) {
  const text = normalizeText(description);
  return Object.entries(SOLUTION_AREAS).flatMap(([area, config]) => {
    const keywords = config.keywords.filter(k => hasWords(text, k));
    return keywords.length ? [{ area, name: config.name, keywords, confidence: 'Needs verification' }] : [];
  });
}
