import {
  Asset,
  AssetField,
  MediaType,
  Query,
  getPermissionsAsync,
  presentPermissionsPicker,
  requestPermissionsAsync,
  type PermissionResponse,
} from 'expo-media-library';
import { Linking, Platform } from 'react-native';

import type { Photo, SortOrder } from '../types';

/** How many photos are fetched from the library per page. */
export const PAGE_SIZE = 60;

export type LibraryAccess = 'checking' | 'granted' | 'limited' | 'denied' | 'blocked';

function accessFromResponse(response: PermissionResponse): LibraryAccess {
  if (response.granted) {
    return response.accessPrivileges === 'limited' ? 'limited' : 'granted';
  }
  return response.canAskAgain ? 'denied' : 'blocked';
}

export async function checkAccess(): Promise<LibraryAccess> {
  return accessFromResponse(await getPermissionsAsync(false, ['photo']));
}

export async function requestAccess(): Promise<LibraryAccess> {
  return accessFromResponse(await requestPermissionsAsync(false, ['photo']));
}

/** Lets the user extend a "limited" selection (iOS 14+, Android 14+). */
export async function pickMorePhotos(): Promise<void> {
  try {
    await presentPermissionsPicker(['photo']);
  } catch {
    // Not available on this platform/version: nothing to do.
  }
}

export async function openSystemSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch {
    // Ignore: the user can still open Settings manually.
  }
}

/**
 * Fetches one page of image metadata. Ordering is by creation time, so the
 * offset is stable as long as the library does not change underneath us.
 */
export async function fetchPhotoPage(
  offset: number,
  order: SortOrder,
  limit: number = PAGE_SIZE,
): Promise<Photo[]> {
  const rows = await new Query()
    .eq(AssetField.MEDIA_TYPE, MediaType.IMAGE)
    .orderBy({ key: AssetField.CREATION_TIME, ascending: order === 'oldest' })
    .offset(offset)
    .limit(limit)
    .exeForMetadata();

  return rows.map((row) => ({
    id: row.id,
    filename: row.filename,
    width: row.width,
    height: row.height,
    creationTime: row.creationTime,
  }));
}

/** Returns true when the asset still exists in the library. */
async function stillExists(photo: Photo): Promise<boolean> {
  try {
    await new Asset(photo.id).getInfo();
    return true;
  } catch {
    return false;
  }
}

export class DeleteCancelledError extends Error {
  constructor() {
    super('El sistema no confirmó el borrado.');
    this.name = 'DeleteCancelledError';
  }
}

/**
 * Deletes the given photos in a single system request. Both iOS and Android
 * show one confirmation dialog for the whole batch. If the user cancels that
 * dialog the native call may throw or resolve silently depending on the OS
 * version, so we double check that the first asset is really gone.
 */
export async function deletePhotos(photos: Photo[]): Promise<void> {
  if (photos.length === 0) return;
  await Asset.delete(photos.map((photo) => new Asset(photo.id)));
  if (await stillExists(photos[0])) {
    throw new DeleteCancelledError();
  }
}

export const platformNotes = {
  /** On iOS deleted photos sit in "Recently Deleted" for 30 days. */
  hasRecycleBin: Platform.OS === 'ios',
};
