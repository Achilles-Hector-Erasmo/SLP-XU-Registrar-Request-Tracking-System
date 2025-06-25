const { searchTrackingCode } = require('../services/searchService');

expect.extend({
  toBeValidTrackingCode(received) {
    const pattern = /^[A-Z_]+_\d+$/;
    const pass = pattern.test(received);
    return {
      message: () => pass 
        ? `expected ${received} not to be a valid tracking code`
        : `expected ${received} to be a valid tracking code (format: SURNAME_NUMBER)`,
      pass,
    };
  },
});

describe('Regular User Search Functionality', () => {
    
    test('Should return tracking data for valid tracking code', () => {
      const trackingCode = 'ERASMO_12345';
      
      const result = searchTrackingCode(trackingCode);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data.trackingCode).toBe('ERASMO_12345');
      expect(result.data.surname).toBe('ERASMO');
      expect(result.data.controlNumber).toBe('12345');
    });


    test('Should return error for non-existent tracking code', () => {
      const invalidCode = 'NONEXISTENT_99999';
  
      const result = searchTrackingCode(invalidCode);
  
      expect(result.success).toBe(false);
      expect(result.error).toBe('Tracking code not found');
      expect(result.message).toContain('does not exist in our system');
    });
});

describe('Case Insensitive Search', () => {
  
  test('Should handle case insensitive tracking codes', () => {
    const testCases = [
      'erasmo_12345',
      'Erasmo_12345',
      'eRaSmO_12345'
    ];
    
    testCases.forEach(input => {
      const result = searchTrackingCode(input);
      expect(result.success).toBe(true);
      expect(result.data.trackingCode).toBe('ERASMO_12345');
    });
  });
});

describe('Input Format Validation', () => {
  
  test('Should reject empty or whitespace-only input', () => {
    const emptyInputCases = [
      { input: '', description: 'Empty string' },
      { input: '   ', description: 'Spaces only' },
      { input: '\t', description: 'Tab only' },
      { input: '\n', description: 'Newline only' },
      { input: '  \t\n  ', description: 'Mixed whitespace' },
    ];
    
    emptyInputCases.forEach(({ input, description }) => {
      const result = searchTrackingCode(input);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid tracking code format');
      expect(result.message).toContain('Please use format: SURNAME_NUMBER');
    });
  });

  test('Should reject input with missing components', () => {
    const missingComponentCases = [
      { input: '_12345', description: 'Missing surname' },
      { input: 'ERASMO_', description: 'Missing control number' },
      { input: 'ERASMO12345', description: 'Missing underscore separator' },
      { input: '_', description: 'Only underscore' },
    ];
    
    missingComponentCases.forEach(({ input, description }) => {
      const result = searchTrackingCode(input);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid tracking code format');
    });
  });

  test('Should reject input with invalid characters in surname', () => {
    const invalidSurnameCases = [
      { input: 'ERAS123_12345', description: 'Numbers in surname' },
      { input: '123SANTOS_67890', description: 'Starts with numbers' },
      { input: 'ERAS-MO_12345', description: 'Hyphen in surname' },
      { input: 'SANT@S_67890', description: 'At symbol in surname' },
      { input: 'GARC.IA_98765', description: 'Dot in surname' },
      { input: 'ERAS MO_12345', description: 'Space in surname' },
      { input: 'ERAS#MO_12345', description: 'Hash in surname' },
    ];
    
    invalidSurnameCases.forEach(({ input, description }) => {
      const result = searchTrackingCode(input);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid tracking code format');
    });
  });

  test('Should reject input with invalid characters in control number', () => {
    const invalidControlNumberCases = [
      { input: 'ERASMO_123ABC', description: 'Letters in control number' },
      { input: 'SANTOS_ABC123', description: 'Starts with letters' },
      { input: 'GARCIA_12-45', description: 'Hyphen in control number' },
      { input: 'LOPEZ_12@45', description: 'Special character in control number' },
      { input: 'SMITH_12 45', description: 'Space in control number' },
      { input: 'BROWN_12.45', description: 'Dot in control number' },
    ];
    
    invalidControlNumberCases.forEach(({ input, description }) => {
      const result = searchTrackingCode(input);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid tracking code format');
    });
  });

  test('Should reject input with wrong separators', () => {
    const wrongSeparatorCases = [
      { input: 'ERASMO-12345', description: 'Hyphen separator' },
      { input: 'SANTOS.67890', description: 'Dot separator' },
      { input: 'GARCIA:98765', description: 'Colon separator' },
      { input: 'LOPEZ|11111', description: 'Pipe separator' },
      { input: 'SMITH 12345', description: 'Space separator' },
      { input: 'BROWN+12345', description: 'Plus separator' },
    ];
    
    wrongSeparatorCases.forEach(({ input, description }) => {
      const result = searchTrackingCode(input);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid tracking code format');
    });
  });

  test('Should reject input with multiple underscores', () => {
    const multipleUnderscoreCases = [
      { input: 'ERASMO__12345', description: 'Double underscore' },
      { input: 'SANTOS_678_90', description: 'Underscore in control number' },
      { input: 'GAR_CIA_98765', description: 'Underscore in surname' },
      { input: '_ERASMO_12345', description: 'Leading underscore' },
      { input: 'ERASMO_12345_', description: 'Trailing underscore' },
    ];
    
    multipleUnderscoreCases.forEach(({ input, description }) => {
      const result = searchTrackingCode(input);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid tracking code format');
    });
  });

  test('Should reject input that is too short', () => {
    const tooShortCases = [
      { input: 'A_1', description: 'Single letter surname, single digit' },
      { input: 'A_12345', description: 'Single letter surname' },
      { input: 'AB_1', description: 'Single digit control number' },
    ];
    
    tooShortCases.forEach(({ input, description }) => {
      const result = searchTrackingCode(input);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid tracking code format');
    });
  });

  test('Should reject input with only one component type', () => {
    const singleComponentCases = [
      { input: '12345', description: 'Only numbers' },
      { input: '67890', description: 'Only numbers (different)' },
      { input: 'ERASMO', description: 'Only letters' },
      { input: 'SANTOS', description: 'Only letters (different)' },
      { input: 'ABC', description: 'Short letters only' },
      { input: '123', description: 'Short numbers only' },
    ];
    
    singleComponentCases.forEach(({ input, description }) => {
      const result = searchTrackingCode(input);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid tracking code format');
    });
  });

  test('Should reject input with trailing special characters', () => {
    const trailingSpecialCharCases = [
      { input: 'ERASMO_12345!', description: 'Exclamation mark' },
      { input: 'SANTOS_67890?', description: 'Question mark' },
      { input: 'GARCIA_98765#', description: 'Hash symbol' },
      { input: 'LOPEZ_11111@', description: 'At symbol' },
      { input: 'SMITH_22222$', description: 'Dollar sign' },
      { input: 'BROWN_33333%', description: 'Percent sign' },
      { input: 'JONES_44444*', description: 'Asterisk' },
      { input: 'DAVIS_55555+', description: 'Plus sign' },
      { input: 'WILSON_66666=', description: 'Equals sign' },
    ];
    
    trailingSpecialCharCases.forEach(({ input, description }) => {
      const result = searchTrackingCode(input);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid tracking code format');
    });
  });

  test('Should reject multiple tracking codes in single input', () => {
    const multipleCodes = [
      { input: 'ERASMO_12345, SANTOS_67890', description: 'Comma separated' },
      { input: 'ERASMO_12345 SANTOS_67890', description: 'Space separated' },
      { input: 'ERASMO_12345; SANTOS_67890', description: 'Semicolon separated' },
      { input: 'ERASMO_12345\nSANTOS_67890', description: 'Newline separated' },
      { input: 'ERASMO_12345,SANTOS_67890,GARCIA_98765', description: 'Three codes' },
      { input: 'ERASMO_12345 | SANTOS_67890', description: 'Pipe separated' },
      { input: 'ERASMO_12345 & SANTOS_67890', description: 'Ampersand separated' },
    ];
    
    multipleCodes.forEach(({ input, description }) => {
      const result = searchTrackingCode(input);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Multiple tracking codes not allowed');
      expect(result.message).toContain('Please enter only one tracking code at a time');
    });
  });
});

describe('Surname Mismatch Validation', () => {
  
  test('Should return error when surname in tracking code does not match stored record', () => {
    const surnameMismatchCases = [
      {
        input: 'SMITH_12345',        // Wrong surname, correct control number for ERASMO_12345
        expectedError: 'Surname mismatch',
        description: 'Using SMITH instead of ERASMO for control number 12345'
      },
      {
        input: 'RODRIGUEZ_67890',    // Wrong surname, correct control number for SANTOS_67890  
        expectedError: 'Surname mismatch',
        description: 'Using RODRIGUEZ instead of SANTOS for control number 67890'
      },
      {
        input: 'LOPEZ_98765',        // Wrong surname, correct control number for GARCIA_98765
        expectedError: 'Surname mismatch', 
        description: 'Using LOPEZ instead of GARCIA for control number 98765'
      },
    ];

    surnameMismatchCases.forEach(({ input, expectedError, description }) => {
      const result = searchTrackingCode(input);
      expect(result.success).toBe(false);
      expect(result.error).toBe(expectedError);
      expect(result.message).toContain('The surname provided does not match our records');
      expect(result.message).toContain('Please verify your tracking code');
    });
  });
});