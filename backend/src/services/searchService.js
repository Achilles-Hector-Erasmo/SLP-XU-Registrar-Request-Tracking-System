const SAMPLE_DATA = {
  'ERASMO_12345': {
    trackingCode: 'ERASMO_12345',
    surname: 'ERASMO',
    controlNumber: '12345',
    status: 'Processing',
    documentType: 'Transcript of Records',
    dateRequested: '2025-01-15',
  },
  'SANTOS_67890': {
    trackingCode: 'SANTOS_67890',
    surname: 'SANTOS',
    controlNumber: '67890',
    status: 'Ready for Pickup',
    documentType: 'Diploma',
    dateRequested: '2025-01-10',
  },
  'GARCIA_98765': {
    trackingCode: 'GARCIA_98765',
    surname: 'GARCIA',
    controlNumber: '98765',
    status: 'Request Received',
    documentType: 'Certificate of Enrollment',
    dateRequested: '2025-01-20',
  }
};

// Create a reverse lookup for control numbers to surnames
const CONTROL_NUMBER_TO_SURNAME = {};
Object.values(SAMPLE_DATA).forEach(record => {
  CONTROL_NUMBER_TO_SURNAME[record.controlNumber] = record.surname;
});

function searchTrackingCode(trackingCode) {
  // Handle empty or whitespace-only input
  if (!trackingCode || typeof trackingCode !== 'string' || trackingCode.trim() === '') {
    return {
      success: false,
      error: 'Invalid tracking code format',
      message: 'Tracking code cannot be empty. Please use format: SURNAME_NUMBER (e.g., ERASMO_12345)'
    };
  }

  // Trim the input
  const trimmedCode = trackingCode.trim();

  // Check for multiple tracking codes FIRST (but only if they actually look like multiple valid codes)
  if (hasMultipleValidCodes(trimmedCode)) {
    return {
      success: false,
      error: 'Multiple tracking codes not allowed',
      message: 'Please enter only one tracking code at a time. Use format: SURNAME_NUMBER (e.g., ERASMO_12345)'
    };
  }

  // Validate format 
  if (!isValidFormat(trimmedCode)) {
    return {
      success: false,
      error: 'Invalid tracking code format',
      message: 'Invalid tracking code format. Please use format: SURNAME_NUMBER (e.g., ERASMO_12345)'
    };
  }

  // Convert to uppercase for case-insensitive search
  const upperCaseCode = trimmedCode.toUpperCase();

  // Check for surname mismatch
  const parts = upperCaseCode.split('_');
  if (parts.length === 2) {
    const surname = parts[0];
    const controlNumber = parts[1];
    
    if (CONTROL_NUMBER_TO_SURNAME[controlNumber] && CONTROL_NUMBER_TO_SURNAME[controlNumber] !== surname) {
      return {
        success: false,
        error: 'Surname mismatch',
        message: 'The surname provided does not match our records for this control number. Please verify your tracking code.'
      };
    }
  }

  // Look up the data
  const data = SAMPLE_DATA[upperCaseCode];
  
  if (data) {
    return { success: true, data };
  }

  return {
    success: false,
    error: 'Tracking code not found',
    message: `Tracking code "${trimmedCode}" does not exist in our system. Please verify and try again.`
  };
}

function isValidFormat(code) {
  // Check if code is string
  if (typeof code !== 'string') {
    return false;
  }

  // Trim the code
  const trimmedCode = code.trim();

  // Check if empty after trimming
  if (trimmedCode === '') {
    return false;
  }

  // Must contain exactly one underscore
  const underscoreCount = (trimmedCode.match(/_/g) || []).length;
  if (underscoreCount !== 1) {
    return false;
  }

  // Split by underscore
  const parts = trimmedCode.split('_');
  if (parts.length !== 2) {
    return false;
  }

  const surname = parts[0];
  const controlNumber = parts[1];

  // Validate surname part
  if (!surname || surname.length < 2) {
    return false;
  }

  // Surname should only contain letters and underscores (but we already split by underscore)
  if (!/^[A-Z]+$/i.test(surname)) {
    return false;
  }

  // Validate control number part
  if (!controlNumber || controlNumber.length < 2) {
    return false;
  }

  // Control number should only contain digits
  if (!/^\d+$/.test(controlNumber)) {
    return false;
  }

  return true;
}

function hasMultipleValidCodes(input) {
  // Split by various separators and check if we actually have multiple valid-looking codes
  const separators = [',', ';', '\n', '|', '&'];
  
  for (const separator of separators) {
    if (input.includes(separator)) {
      const parts = input.split(separator).map(part => part.trim()).filter(part => part.length > 0);
      if (parts.length > 1) {
        // Check if we have multiple parts that look like valid tracking codes
        const validCodePattern = /^[A-Z_]+_\d+$/i;
        const validCodes = parts.filter(part => validCodePattern.test(part));
        if (validCodes.length > 1) {
          return true;
        }
      }
    }
  }

  // Check for space-separated codes
  const spaceParts = input.split(/\s+/).filter(part => part.length > 0);
  if (spaceParts.length > 1) {
    const validCodePattern = /^[A-Z_]+_\d+$/i;
    const validCodes = spaceParts.filter(part => validCodePattern.test(part));
    if (validCodes.length > 1) {
      return true;
    }
  }

  return false;
}

module.exports = {
  searchTrackingCode,
  isValidFormat
};
