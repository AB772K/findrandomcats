/**
 * Premium note packages. Plain module rather than part of actions.ts: a
 * 'use server' file may only export async functions, and these are shared
 * constants the server and client both read.
 */
export const NOTE_PACKAGES = [
  { id: 'starter', notes: 10, price: '$1.99', popular: false },
  { id: 'regular', notes: 50, price: '$7.99', popular: true },
  { id: 'jumbo', notes: 200, price: '$24.99', popular: false },
] as const;

export type NotePackage = (typeof NOTE_PACKAGES)[number];
export type NotePackageId = NotePackage['id'];

/** Looks a package up by id. Prices are never taken from the client. */
export function findNotePackage(id: string): NotePackage | null {
  return NOTE_PACKAGES.find((pkg) => pkg.id === id) ?? null;
}
