// https://www.linkedin.com/in/jane-doe-123abc/ -> "jane-doe-123abc"
export function parsePublicIdentifier(input: string): string {
  const trimmed = input.trim();
  const bare = /^[a-zA-Z0-9-]+$/;
  if (bare.test(trimmed)) return trimmed;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(`Not a valid LinkedIn profile URL or identifier: "${input}"`);
  }

  if (!url.hostname.endsWith("linkedin.com")) {
    throw new Error(`Not a linkedin.com URL: "${input}"`);
  }

  const match = url.pathname.match(/\/in\/([^/]+)\/?/);
  if (!match) {
    throw new Error(`Could not find /in/<identifier> in URL: "${input}"`);
  }

  return decodeURIComponent(match[1]);
}
