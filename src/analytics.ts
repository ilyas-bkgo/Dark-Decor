import { supabase } from './orders';

export type FunnelEventName =
  | 'page_view'
  | 'cta_click'
  | 'offer_selected'
  | 'form_started'
  | 'form_field_reached'
  | 'form_submitted'
  | 'form_error';
export type Offer = 'one' | 'two';
export type CtaSection = 'header' | 'hero' | 'offers' | 'final_cta' | 'sticky_mobile';
export type FormField = 'name' | 'phone' | 'city' | 'address' | 'note' | 'quantity';
export type AnalyticsSummary = {
  visitors: number;
  cta_clicks: number;
  cta_sessions: number;
  form_started: number;
  form_submitted: number;
  submitted_sessions: number;
  abandoned: number;
  conversion_rate: number;
  last_fields: AnalyticsCount[];
  cta_locations: AnalyticsCount[];
  offers: AnalyticsCount[];
  devices: AnalyticsCount[];
  sources: AnalyticsCount[];
  daily: AnalyticsDaily[];
};
export type AnalyticsCount = { label: string | null; count: number };
export type AnalyticsDaily = {
  day: string;
  visitors: number;
  cta_clicks: number;
  form_started: number;
  form_submitted: number;
};

type EventPayload = {
  id?: string;
  event_name: FunnelEventName;
  page_section?: string;
  offer?: Offer;
  last_field?: FormField;
};

declare global {
  interface Window {
    doNotTrack?: string;
    fbq?: (
      command: string,
      eventName: string,
      parameters?: Record<string, string | number>,
      options?: { eventID?: string },
    ) => void;
  }
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const pixelId = import.meta.env.VITE_META_PIXEL_ID?.trim();
const consentKey = 'dark-decor-meta-consent';
const sessionKey = 'dark-decor-analytics-session';
const startedKey = 'dark-decor-form-started';
const reachedKey = 'dark-decor-form-fields';
const allowedFields: FormField[] = ['name', 'phone', 'city', 'address', 'note', 'quantity'];
let authReady = false;
let adminSession = false;
let initialization: Promise<void> | undefined;
let pixelLoaded = false;
let pixelConsent = false;
let consentDeclined = false;
let volatileSessionId: string | undefined;
let offersViewed = false;
let pixelViewContentSent = false;
let formWasStarted = false;
let pixelCheckoutSent = false;

const trackingAllowed = (): boolean => {
  if (typeof window === 'undefined' || location.pathname === '/admin') return false;
  if (navigator.doNotTrack === '1' || navigator.doNotTrack === 'yes' || window.doNotTrack === '1') return false;
  return authReady && !adminSession;
};

function getSessionId(): string {
  try {
    const existing = sessionStorage.getItem(sessionKey);
    if (existing) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem(sessionKey, id);
    return id;
  } catch {
    volatileSessionId ??= crypto.randomUUID();
    return volatileSessionId;
  }
}

function getTrafficSource(): { referrer_source: string | null; utm_campaign: string | null } {
  const params = new URLSearchParams(location.search);
  const source = params.get('utm_source')?.trim();
  let host: string | null = null;
  if (!source && document.referrer) {
    try {
      host = new URL(document.referrer).hostname.slice(0, 255) || null;
    } catch {
      host = null;
    }
  }
  return {
    referrer_source: (source || host)?.slice(0, 255) ?? null,
    utm_campaign: params.get('utm_campaign')?.trim().slice(0, 200) || null,
  };
}

function loadPixel(): void {
  if (pixelLoaded || !pixelId || !pixelConsent || !trackingAllowed()) return;
  pixelLoaded = true;
  const queue: NonNullable<Window['fbq']> = (...args) => {
    const fbq = queue as typeof queue & { callMethod?: (...values: Parameters<typeof queue>) => void; queue?: unknown[]; loaded?: boolean; version?: string };
    if (fbq.callMethod) fbq.callMethod(...args);
    else (fbq.queue ??= []).push(args);
  };
  const fbq = queue as typeof queue & { queue?: unknown[]; loaded?: boolean; version?: string; push?: typeof queue };
  fbq.queue = [];
  fbq.loaded = true;
  fbq.version = '2.0';
  fbq.push = queue;
  window.fbq = queue;
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.append(script);
  window.fbq('init', pixelId);
}

function sendPixelViewContent(): void {
  if (!offersViewed || pixelViewContentSent || !pixelConsent || !trackingAllowed()) return;
  loadPixel();
  window.fbq?.('track', 'ViewContent');
  pixelViewContentSent = true;
}

function sendPixelInitiateCheckout(): void {
  if (!formWasStarted || pixelCheckoutSent || !pixelConsent || !trackingAllowed()) return;
  loadPixel();
  window.fbq?.('track', 'InitiateCheckout');
  pixelCheckoutSent = true;
}

function showMetaConsent(): void {
  if (!pixelId || pixelConsent || consentDeclined || !trackingAllowed() || document.getElementById('meta-consent-banner')) return;
  const banner = document.createElement('aside');
  banner.id = 'meta-consent-banner';
  banner.className = 'meta-consent-banner';
  banner.setAttribute('aria-label', 'إعدادات ملفات تعريف الارتباط');
  const message = document.createElement('p');
  message.textContent = 'نستعمل ملفات تعريف الارتباط لقياس أداء الصفحة وتحسين الإعلانات.';
  const privacy = document.createElement('a');
  privacy.href = '/privacy.html';
  privacy.textContent = 'سياسة الخصوصية';
  const accept = document.createElement('button');
  accept.type = 'button';
  accept.textContent = 'موافقة';
  accept.addEventListener('click', () => {
    acceptMetaConsent();
    banner.remove();
  });
  const decline = document.createElement('button');
  decline.type = 'button';
  decline.className = 'consent-decline';
  decline.textContent = 'ليس الآن';
  decline.addEventListener('click', () => {
    try {
      localStorage.setItem(consentKey, 'declined');
    } catch {
      pixelConsent = false;
    }
    consentDeclined = true;
    banner.remove();
  });
  banner.append(message, privacy, accept, decline);
  document.body.append(banner);
}

export function startAnalytics(): Promise<void> {
  if (initialization) return initialization;
  try {
    const storedConsent = localStorage.getItem(consentKey);
    pixelConsent = storedConsent === 'accepted';
    consentDeclined = storedConsent === 'declined';
  } catch {
    pixelConsent = false;
  }
  initialization = new Promise((resolve) => {
    if (!supabase) {
      authReady = true;
      loadPixel();
      showMetaConsent();
      resolve();
      return;
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      adminSession = Boolean(session?.user);
      authReady = true;
      if (!adminSession) {
        loadPixel();
        showMetaConsent();
        sendPixelViewContent();
      }
    });
    void supabase.auth.getSession().then(({ data }) => {
      adminSession = Boolean(data.session?.user);
      authReady = true;
      if (!adminSession) {
        loadPixel();
        showMetaConsent();
        sendPixelViewContent();
      }
      resolve();
    });
    window.addEventListener('pagehide', () => subscription.unsubscribe(), { once: true });
  });
  return initialization;
}

export function hasMetaConsent(): boolean {
  return pixelConsent;
}

export function acceptMetaConsent(): void {
  pixelConsent = true;
  try {
    localStorage.setItem(consentKey, 'accepted');
  } catch {
    // The choice remains valid for this page even when storage is unavailable.
  }
  if (!trackingAllowed()) return;
  loadPixel();
  window.fbq?.('track', 'PageView');
  sendPixelViewContent();
  sendPixelInitiateCheckout();
}

function sendOwnEvent(payload: EventPayload): void {
  if (!trackingAllowed() || !supabaseUrl || !publishableKey) return;
  const traffic = getTrafficSource();
  const body = {
    ...(payload.id ? { id: payload.id } : {}),
    session_id: getSessionId(),
    event_name: payload.event_name,
    page_section: payload.page_section ?? null,
    offer: payload.offer ?? null,
    last_field: payload.last_field ?? null,
    device: matchMedia('(max-width: 760px)').matches ? 'mobile' : 'desktop',
    ...traffic,
  };
  void fetch(`${supabaseUrl}/rest/v1/events`, {
    method: 'POST',
    keepalive: true,
    headers: {
      apikey: publishableKey,
      authorization: `Bearer ${publishableKey}`,
      'content-type': 'application/json',
      prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  }).catch(() => undefined);
}

export function trackPageView(): void {
  sendOwnEvent({ event_name: 'page_view', page_section: 'landing' });
  if (pixelConsent && trackingAllowed()) {
    loadPixel();
    window.fbq?.('track', 'PageView');
  }
}

export function trackViewContent(): void {
  offersViewed = true;
  sendPixelViewContent();
}

export function trackCtaClick(section: CtaSection): void {
  sendOwnEvent({ event_name: 'cta_click', page_section: section });
}

export function trackOfferSelected(offer: Offer): void {
  sendOwnEvent({ event_name: 'offer_selected', offer, page_section: 'offers' });
}

export function trackFormFieldReached(field: FormField): void {
  if (!allowedFields.includes(field) || !trackingAllowed()) return;
  formWasStarted = true;
  try {
    const reached: FormField[] = JSON.parse(sessionStorage.getItem(reachedKey) ?? '[]') as FormField[];
    if (reached.includes(field)) return;
    reached.push(field);
    sessionStorage.setItem(reachedKey, JSON.stringify(reached));
    const alreadyStarted = sessionStorage.getItem(startedKey) === 'yes';
    if (!alreadyStarted) {
      sessionStorage.setItem(startedKey, 'yes');
      sendOwnEvent({ event_name: 'form_started' });
    }
  } catch {
    sendOwnEvent({ event_name: 'form_started' });
  }
  sendPixelInitiateCheckout();
  sendOwnEvent({ event_name: 'form_field_reached', last_field: field });
}

export function trackFormError(offer: Offer): void {
  sendOwnEvent({ event_name: 'form_error', offer });
}

export function trackLead(offer: Offer, value: number): string {
  const eventID = crypto.randomUUID();
  sendOwnEvent({ id: eventID, event_name: 'form_submitted', offer });
  if (pixelConsent && trackingAllowed()) {
    loadPixel();
    window.fbq?.('track', 'Lead', { value, currency: 'MAD' }, { eventID });
  }
  return eventID;
}

export async function getAnalyticsSummary(from: string, to: string): Promise<AnalyticsSummary> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc('analytics_summary', { p_from: from, p_to: to });
  if (error) throw error;
  return data;
}
