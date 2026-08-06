/**
 * @jest-environment jsdom
 */
import { extractProfileSlug, parseActiveThreadContact, parseHeadline, buildCapturePayload } from '../src/lib/linkedinParser.js';

function mountFixture(html) {
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  return container;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('extractProfileSlug', () => {
  it('extracts the slug from a full profile URL', () => {
    expect(extractProfileSlug('https://www.linkedin.com/in/jane-doe-12345/')).toBe('jane-doe-12345');
  });

  it('extracts the slug from a relative URL with query params', () => {
    expect(extractProfileSlug('/in/jane-doe-12345/?trk=nav')).toBe('jane-doe-12345');
  });

  it('returns null for a non-profile URL', () => {
    expect(extractProfileSlug('https://www.linkedin.com/feed/')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(extractProfileSlug('')).toBeNull();
    expect(extractProfileSlug(null)).toBeNull();
  });
});

describe('parseActiveThreadContact', () => {
  it('reads the name and profile URL from the active thread header', () => {
    const root = mountFixture(`
      <div class="msg-overlay-conversation-bubble msg-overlay-conversation-bubble--is-active">
        <div class="msg-title-bar">
          <h2 class="msg-entity-lockup__entity-title">  Jane   Doe  </h2>
        </div>
        <a class="msg-thread__link-to-profile" href="/in/jane-doe-12345/">profile</a>
      </div>
    `);
    expect(parseActiveThreadContact(root)).toEqual({
      name: 'Jane Doe',
      profileUrl: '/in/jane-doe-12345/',
      slug: 'jane-doe-12345'
    });
  });

  it('returns nulls when no active thread is open', () => {
    const root = mountFixture('<div class="msg-overlay-conversation-bubble">nothing active</div>');
    expect(parseActiveThreadContact(root)).toEqual({ name: null, profileUrl: null, slug: null });
  });

  it('falls back to the alternate title selector', () => {
    const root = mountFixture(`
      <div class="msg-overlay-conversation-bubble--is-active">
        <h2 class="msg-title-bar__title">John Smith</h2>
      </div>
    `);
    expect(parseActiveThreadContact(root).name).toBe('John Smith');
  });
});

describe('parseHeadline', () => {
  it('reads and normalizes whitespace from a headline element', () => {
    const container = mountFixture(`
      <div class="msg-entity-lockup">
        <span class="msg-entity-lockup__entity-info">
          Software   Engineer
          at Acme Corp
        </span>
      </div>
    `);
    const card = container.querySelector('.msg-entity-lockup');
    expect(parseHeadline(card)).toBe('Software Engineer at Acme Corp');
  });

  it('returns null when the card has no headline element', () => {
    const container = mountFixture('<div class="msg-entity-lockup"></div>');
    expect(parseHeadline(container.querySelector('.msg-entity-lockup'))).toBeNull();
  });

  it('returns null when cardEl itself is null', () => {
    expect(parseHeadline(null)).toBeNull();
  });
});

describe('buildCapturePayload', () => {
  it('combines contact info and headline into one payload', () => {
    const root = mountFixture(`
      <div class="msg-overlay-conversation-bubble--is-active">
        <div class="msg-entity-lockup">
          <h2 class="msg-entity-lockup__entity-title">Jane Doe</h2>
          <span class="msg-entity-lockup__entity-info">Product Manager at Acme</span>
        </div>
        <a class="msg-thread__link-to-profile" href="/in/jane-doe-99/">profile</a>
      </div>
    `);
    expect(buildCapturePayload(root)).toEqual({
      name: 'Jane Doe',
      profileUrl: '/in/jane-doe-99/',
      slug: 'jane-doe-99',
      headline: 'Product Manager at Acme'
    });
  });

  it('returns a null headline when there is no matching card', () => {
    const root = mountFixture(`
      <div class="msg-overlay-conversation-bubble--is-active">
        <h2 class="msg-title-bar__title">Jane Doe</h2>
      </div>
    `);
    expect(buildCapturePayload(root).headline).toBeNull();
  });
});
