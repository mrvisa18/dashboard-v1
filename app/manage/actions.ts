'use server';
// Aktionen auf der Seite „Verwalten“ (laufen auf dem Server).
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db, ensureSchema } from '@/lib/db';
import { upsertProfile } from '@/lib/sync';
import { errorMessage } from '@/lib/util';
import * as youtube from '@/lib/platforms/youtube';

function id(form: FormData, key = 'id'): number {
  const n = Number(form.get(key));
  if (!Number.isInteger(n) || n <= 0) redirect('/manage?error=' + encodeURIComponent('Ungültige Auswahl'));
  return n;
}

function text(form: FormData, key: string, max = 60): string {
  return String(form.get(key) ?? '').trim().slice(0, max);
}

export async function createChannel(form: FormData) {
  const name = text(form, 'name');
  if (!name) redirect('/manage?error=' + encodeURIComponent('Bitte einen Namen eingeben'));
  await ensureSchema();
  await db()`INSERT INTO channels (name, position) SELECT ${name}, COALESCE(MAX(position), 0) + 1 FROM channels`;
  revalidatePath('/', 'layout');
  redirect('/manage');
}

export async function renameChannel(form: FormData) {
  const channelId = id(form);
  const name = text(form, 'name');
  if (!name) redirect('/manage?error=' + encodeURIComponent('Name darf nicht leer sein'));
  await db()`UPDATE channels SET name = ${name} WHERE id = ${channelId}`;
  revalidatePath('/', 'layout');
  redirect('/manage?msg=' + encodeURIComponent('Gespeichert ✓'));
}

export async function deleteChannel(form: FormData) {
  const channelId = id(form);
  await db()`DELETE FROM channels WHERE id = ${channelId}`;
  revalidatePath('/', 'layout');
  redirect('/manage?msg=' + encodeURIComponent('Kanal gelöscht'));
}

export async function addYoutube(form: FormData) {
  const channelId = id(form, 'channel');
  const input = text(form, 'handle', 300);
  let profileId: number;
  try {
    const info = await youtube.getChannel(youtube.parseChannelInput(input));
    profileId = await upsertProfile(channelId, 'youtube', info);
  } catch (e) {
    redirect('/manage?error=' + encodeURIComponent(errorMessage(e)));
  }
  revalidatePath('/', 'layout');
  redirect(`/manage?connected=${profileId}`);
}

export async function removeProfile(form: FormData) {
  const profileId = id(form);
  await db()`DELETE FROM profiles WHERE id = ${profileId}`;
  revalidatePath('/', 'layout');
  redirect('/manage?msg=' + encodeURIComponent('Account getrennt – alle Daten dazu wurden gelöscht'));
}
