import { voyagerGet } from "./client.js";

// Raw shape of /identity/profiles/{id}/profileView: a flat "included" array
// of entities (profile, positions, education, skills, ...) rather than a
// nested object — LinkedIn's normalized-json convention. See
// normalizeVoyager.ts for how this gets picked apart.
export async function fetchVoyagerProfileView(
  publicIdentifier: string,
  storageStateJson: string,
): Promise<unknown> {
  return voyagerGet(`/identity/profiles/${publicIdentifier}/profileView`, storageStateJson);
}
