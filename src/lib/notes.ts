/**
 * Premium note packages. Plain module rather than part of actions.ts: a
 * 'use server' file may only export async functions, and these are shared
 * constants the server and client both read.
 */
// The three tiers planned for Lemon Squeezy (see PAYMENTS.md). The id is the
// note count, which is also how the variant env vars will be named. Display
// only for now: startCheckout() still answers that payments are not live.
export const NOTE_PACKAGES = [
  { id: '100', notes: 100, price: '$5', popular: false },
  { id: '350', notes: 350, price: '$15', popular: true },
  { id: '650', notes: 650, price: '$25', popular: false },
] as const;

export type NotePackage = (typeof NOTE_PACKAGES)[number];
export type NotePackageId = NotePackage['id'];

/** Looks a package up by id. Prices are never taken from the client. */
export function findNotePackage(id: string): NotePackage | null {
  return NOTE_PACKAGES.find((pkg) => pkg.id === id) ?? null;
}
