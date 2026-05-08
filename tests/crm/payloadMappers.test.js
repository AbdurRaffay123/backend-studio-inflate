'use strict';

/**
 * Unit tests for src/modules/crm/utils/payloadMappers.js
 *
 * Covers:
 *  - mapConsultationPayload  — all field sources, type normalisation, S3 image arrays,
 *                              flat vs nested intake, edge cases
 *  - mapCustomerProfile      — direct fields, fullName split, address sanitisation,
 *                              profilePictureUrl / acceptsMarketing persistence
 */

const { mapConsultationPayload, mapCustomerProfile } = require('../../src/modules/crm/utils/payloadMappers');

// ─────────────────────────────────────────────────────────────────────────────
// mapConsultationPayload
// ─────────────────────────────────────────────────────────────────────────────

describe('mapConsultationPayload', () => {
  const GID = 'gid://shopify/Customer/99999';

  it('maps a complete flat mobile payload', () => {
    const body = {
      shopifyCustomerId: GID,
      type:              'phone',
      shopifyOrderId:    'order-001',
      scheduledDate:     '2026-07-04T14:00:00.000Z',
      scheduledTime:     '14:00',
      duration:          30,
      price:             50,
      eventType:         'Wedding',
      eventDate:         '2026-08-15T00:00:00.000Z',
      guestCount:        '80',
      selectedServices:  ['Balloon arch', 'Table centrepieces'],
      selectedBudget:    '$1 000–$2 000',
      colorPalette:      'Navy & gold',
      projectDescription:'Modern elegant ceremony',
      uploadedImages:    ['https://s3.amazonaws.com/bucket/img1.jpg', 'https://s3.amazonaws.com/bucket/img2.jpg'],
      additionalNotes:   'Please arrive 30 min early',
    };

    const result = mapConsultationPayload(body);

    expect(result.shopifyCustomerId).toBe(GID);
    expect(result.type).toBe('phone');
    expect(result.shopifyOrderId).toBe('order-001');
    expect(result.duration).toBe(30);
    expect(result.price).toBe(50);

    const { intake } = result;
    expect(intake.eventType).toBe('Wedding');
    expect(intake.guestCount).toBe(80);
    expect(intake.services).toEqual(['Balloon arch', 'Table centrepieces']);
    expect(intake.budgetRange).toBe('$1 000–$2 000');
    expect(intake.colorPalette).toBe('Navy & gold');
    expect(intake.narrative).toBe('Modern elegant ceremony');
    expect(intake.inspirationPics).toEqual([
      'https://s3.amazonaws.com/bucket/img1.jpg',
      'https://s3.amazonaws.com/bucket/img2.jpg',
    ]);
    expect(intake.additionalNotes).toBe('Please arrive 30 min early');
    expect(intake.venueName).toBe('');
  });

  it('prefers nested intake object over flat fields', () => {
    const body = {
      shopifyCustomerId: GID,
      type:              'virtual',
      projectDescription:'Overridden by intake.narrative',
      uploadedImages:    ['https://s3.amazonaws.com/bucket/old.jpg'],
      intake: {
        narrative:       'Nested narrative wins',
        inspirationPics: ['https://s3.amazonaws.com/bucket/new.jpg'],
        eventType:       'Birthday',
        budgetRange:     '$500',
      },
    };

    const result = mapConsultationPayload(body);
    expect(result.intake.narrative).toBe('Nested narrative wins');
    expect(result.intake.inspirationPics).toEqual(['https://s3.amazonaws.com/bucket/new.jpg']);
    expect(result.intake.eventType).toBe('Birthday');
  });

  it('accepts consultationType as an alias for type', () => {
    const result = mapConsultationPayload({
      shopifyCustomerId: GID,
      consultationType:  'in_person',
    });
    expect(result.type).toBe('in_person');
  });

  it('normalises hyphenated type "in-person" → "in_person"', () => {
    const result = mapConsultationPayload({
      shopifyCustomerId: GID,
      type:              'in-person',
    });
    expect(result.type).toBe('in_person');
  });

  it('strips empty and whitespace-only strings from inspirationPics', () => {
    const result = mapConsultationPayload({
      shopifyCustomerId: GID,
      type:              'phone',
      uploadedImages:    ['  ', '', 'https://s3.amazonaws.com/bucket/real.jpg', '  '],
    });
    expect(result.intake.inspirationPics).toEqual(['https://s3.amazonaws.com/bucket/real.jpg']);
  });

  it('returns empty inspirationPics array when none provided', () => {
    const result = mapConsultationPayload({ shopifyCustomerId: GID, type: 'phone' });
    expect(result.intake.inspirationPics).toEqual([]);
  });

  it('converts string guestCount to number', () => {
    const result = mapConsultationPayload({
      shopifyCustomerId: GID, type: 'phone', guestCount: '150',
    });
    expect(result.intake.guestCount).toBe(150);
  });

  it('sets guestCount to undefined for non-numeric value', () => {
    const result = mapConsultationPayload({
      shopifyCustomerId: GID, type: 'phone', guestCount: 'many',
    });
    expect(result.intake.guestCount).toBeUndefined();
  });

  it('converts ISO eventDate string to a Date', () => {
    const result = mapConsultationPayload({
      shopifyCustomerId: GID, type: 'phone', eventDate: '2027-01-01',
    });
    expect(result.intake.eventDate).toBeInstanceOf(Date);
  });

  it('sets shopifyCustomerId to empty string when missing', () => {
    const result = mapConsultationPayload({ type: 'phone' });
    expect(result.shopifyCustomerId).toBe('');
  });

  it('trims whitespace from shopifyCustomerId', () => {
    const result = mapConsultationPayload({ shopifyCustomerId: '  gid://shopify/Customer/1  ', type: 'phone' });
    expect(result.shopifyCustomerId).toBe('gid://shopify/Customer/1');
  });

  it('preserves shopifyOrderId and shopifyOrderName as null when absent', () => {
    const result = mapConsultationPayload({ shopifyCustomerId: GID, type: 'phone' });
    expect(result.shopifyOrderId).toBeNull();
    expect(result.shopifyOrderName).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// mapCustomerProfile
// ─────────────────────────────────────────────────────────────────────────────

describe('mapCustomerProfile', () => {
  const GID = 'gid://shopify/Customer/77777';
  const EMAIL = 'jane@example.com';

  it('maps a complete customer profile', () => {
    const body = {
      shopifyCustomerId: GID,
      email:             EMAIL,
      firstName:         'Jane',
      lastName:          'Doe',
      phone:             '+14155550123',
      profilePictureUrl: 'https://s3.amazonaws.com/bucket/avatar.jpg',
      acceptsMarketing:  true,
      addresses: [
        { address1: '123 Main St', city: 'LA', country: 'US' },
        { address1: '  ', city: '', country: null },           // should be stripped
      ],
      defaultAddress: { address1: '123 Main St', city: 'LA', country: 'US' },
    };

    const result = mapCustomerProfile(body);

    expect(result.shopifyCustomerId).toBe(GID);
    expect(result.email).toBe(EMAIL);
    expect(result.firstName).toBe('Jane');
    expect(result.lastName).toBe('Doe');
    expect(result.phone).toBe('+14155550123');
    expect(result.profilePictureUrl).toBe('https://s3.amazonaws.com/bucket/avatar.jpg');
    expect(result.acceptsMarketing).toBe(true);
    // empty address should be removed
    expect(result.addresses).toHaveLength(1);
    expect(result.addresses[0].address1).toBe('123 Main St');
    expect(result.defaultAddress.city).toBe('LA');
  });

  it('splits fullName into firstName / lastName when individual fields are absent', () => {
    const result = mapCustomerProfile({
      shopifyCustomerId: GID,
      email:             EMAIL,
      fullName:          'John Smith Jr',
    });
    expect(result.firstName).toBe('John');
    expect(result.lastName).toBe('Smith Jr');
  });

  it('prefers explicit firstName / lastName over fullName split', () => {
    const result = mapCustomerProfile({
      shopifyCustomerId: GID,
      email:             EMAIL,
      fullName:          'John Smith',
      firstName:         'Jane',
      lastName:          'Doe',
    });
    expect(result.firstName).toBe('Jane');
    expect(result.lastName).toBe('Doe');
  });

  it('stores profilePictureUrl (S3 link) without modification', () => {
    const s3Url = 'https://my-bucket.s3.us-east-1.amazonaws.com/uploads/avatars/uuid.jpg';
    const result = mapCustomerProfile({
      shopifyCustomerId: GID, email: EMAIL, profilePictureUrl: s3Url,
    });
    expect(result.profilePictureUrl).toBe(s3Url);
  });

  it('returns profilePictureUrl as empty string when absent', () => {
    const result = mapCustomerProfile({ shopifyCustomerId: GID, email: EMAIL });
    expect(result.profilePictureUrl).toBe('');
  });

  it('returns acceptsMarketing as undefined when not a boolean', () => {
    const result = mapCustomerProfile({
      shopifyCustomerId: GID, email: EMAIL, acceptsMarketing: 'yes',
    });
    expect(result.acceptsMarketing).toBeUndefined();
  });

  it('keeps acceptsMarketing = false', () => {
    const result = mapCustomerProfile({
      shopifyCustomerId: GID, email: EMAIL, acceptsMarketing: false,
    });
    expect(result.acceptsMarketing).toBe(false);
  });

  it('strips null values from individual address fields', () => {
    const result = mapCustomerProfile({
      shopifyCustomerId: GID,
      email:             EMAIL,
      addresses:         [{ address1: '1 Road', city: null, zip: '' }],
    });
    expect(result.addresses[0]).not.toHaveProperty('city');
    expect(result.addresses[0]).not.toHaveProperty('zip');
    expect(result.addresses[0].address1).toBe('1 Road');
  });

  it('returns defaultAddress as null when address is empty', () => {
    const result = mapCustomerProfile({
      shopifyCustomerId: GID,
      email:             EMAIL,
      defaultAddress:    { address1: '  ', city: null },
    });
    expect(result.defaultAddress).toBeNull();
  });

  it('returns undefined addresses when not an array', () => {
    const result = mapCustomerProfile({
      shopifyCustomerId: GID, email: EMAIL, addresses: 'not-an-array',
    });
    expect(result.addresses).toBeUndefined();
  });

  it('handles an empty body gracefully', () => {
    const result = mapCustomerProfile({});
    expect(result.shopifyCustomerId).toBe('');
    expect(result.email).toBe('');
    expect(result.firstName).toBe('');
    expect(result.addresses).toBeUndefined();
  });
});
