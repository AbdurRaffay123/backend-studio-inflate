'use strict';

const TYPES = ['phone', 'virtual', 'in_person'];

const normalizeString = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const normalizeStringArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
};

const normalizeType = (value) => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase().replace('-', '_');
  return TYPES.includes(normalized) ? normalized : null;
};

const sanitizeAddress = (address) => {
  if (!address || typeof address !== 'object') return null;
  const out = {};
  for (const [key, value] of Object.entries(address)) {
    if (value == null) continue;
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (normalized) out[key] = normalized;
      continue;
    }
    out[key] = value;
  }
  return Object.keys(out).length ? out : null;
};

const splitFullName = (fullName) => {
  const normalized = normalizeString(fullName);
  if (!normalized) {
    return { firstName: '', lastName: '' };
  }

  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
};

const toDateOrUndefined = (value) => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
};

const mapConsultationPayload = (body = {}) => {
  const type = normalizeType(body.type) || normalizeType(body.consultationType);

  const intakeFromBody = body.intake && typeof body.intake === 'object' ? body.intake : {};

  const intake = {
    eventType: normalizeString(intakeFromBody.eventType || body.eventType),
    eventDate: toDateOrUndefined(intakeFromBody.eventDate || body.eventDate || body.startDate),
    eventTime: normalizeString(intakeFromBody.eventTime || body.eventTime || body.startTime),
    endDate: toDateOrUndefined(intakeFromBody.endDate || body.endDate),
    endTime: normalizeString(intakeFromBody.endTime || body.endTime),
    venueName: normalizeString(intakeFromBody.venueName || body.venueName),
    venueType: normalizeString(intakeFromBody.venueType || body.venueType),
    venueAddress: normalizeString(intakeFromBody.venueAddress || body.venueAddress),
    setupLocation: normalizeString(intakeFromBody.setupLocation || body.setupLocation),
    setupDate: toDateOrUndefined(intakeFromBody.setupDate || body.setupDate),
    setupTime: normalizeString(intakeFromBody.setupTime || body.setupTime),
    tearDownDate: toDateOrUndefined(intakeFromBody.tearDownDate || body.tearDownDate),
    tearDownTime: normalizeString(intakeFromBody.tearDownTime || body.tearDownTime),
    guestCount:
      Number.isFinite(Number(intakeFromBody.guestCount ?? body.guestCount))
        ? Number(intakeFromBody.guestCount ?? body.guestCount)
        : undefined,
    services: normalizeStringArray(intakeFromBody.services || body.selectedServices),
    budgetRange: normalizeString(intakeFromBody.budgetRange || body.selectedBudget),
    colorPalette: normalizeString(intakeFromBody.colorPalette || body.colorPalette),
    narrative: normalizeString(intakeFromBody.narrative || body.projectDescription),
    inspirationPics: normalizeStringArray(
      intakeFromBody.inspirationPics || body.uploadedImages
    ),
    additionalNotes: normalizeString(
      intakeFromBody.additionalNotes || body.additionalNotes
    ),
  };

  // Snapshot contact info on the consultation itself (Customer doc may drift later).
  const fullNameParts = splitFullName(body.fullName);
  const fullName =
    normalizeString(body.fullName) ||
    [
      normalizeString(body.firstName) || fullNameParts.firstName,
      normalizeString(body.lastName) || fullNameParts.lastName,
    ]
      .filter(Boolean)
      .join(' ');

  return {
    shopifyCustomerId: normalizeString(body.shopifyCustomerId),
    shopifyOrderId: body.shopifyOrderId ?? null,
    shopifyOrderName: body.shopifyOrderName ?? null,
    fullName,
    email: normalizeString(body.email),
    phone: normalizeString(body.phone),
    type: type || body.type,
    scheduledDate: toDateOrUndefined(body.scheduledDate),
    scheduledTime: normalizeString(body.scheduledTime),
    duration: body.duration,
    price: body.price,
    intake,
  };
};

const mapCustomerProfile = (body = {}) => {
  const fullNameParts = splitFullName(body.fullName);
  const firstName = normalizeString(body.firstName) || fullNameParts.firstName;
  const lastName = normalizeString(body.lastName) || fullNameParts.lastName;

  return {
    shopifyCustomerId: normalizeString(body.shopifyCustomerId),
    email: normalizeString(body.email),
    firstName,
    lastName,
    phone: normalizeString(body.phone),
    profilePictureUrl: normalizeString(body.profilePictureUrl),
    acceptsMarketing:
      typeof body.acceptsMarketing === 'boolean' ? body.acceptsMarketing : undefined,
    addresses: Array.isArray(body.addresses)
      ? body.addresses.map(sanitizeAddress).filter(Boolean)
      : undefined,
    defaultAddress: sanitizeAddress(body.defaultAddress),
  };
};

module.exports = {
  mapConsultationPayload,
  mapCustomerProfile,
};
