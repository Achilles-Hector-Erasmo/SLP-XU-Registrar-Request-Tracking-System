const { DataEntryService } = require('../services/dataEntryService');
const { AccessControlService } = require('../services/accessControlService');

describe('DataEntryService - TDD Implementation', () => {
  let dataEntryService;
  let accessControlService;

  beforeEach(() => {
    accessControlService = new AccessControlService();
    dataEntryService = new DataEntryService(accessControlService);
  });

    describe('DataEntryService Construction', () => {
    test('should create DataEntryService instance with AccessControlService dependency', () => {
      expect(dataEntryService).toBeDefined();
      expect(dataEntryService.accessControlService).toBeDefined();
    });

    test('should throw error when created without AccessControlService', () => {
      expect(() => new DataEntryService()).toThrow('AccessControlService is required');
    });
  });

  describe('Student Details Validation - TDD Red Phase', () => {
    test('should validate complete student details and return success object', () => {
      const validStudentData = {
        lastName: 'SANTOS',
        firstName: 'MARIA',
        middleName: 'GARCIA',
        year: '4th Year',
        program: 'BS Computer Science',
        contactNumber: '09171234567',
        evaluator: 'evaluator@xu.edu.ph'
      };

      const result = dataEntryService.validateStudentDetails(validStudentData);
      
      // This test drives the implementation of validateStudentDetails method
      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('sanitizedData');
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.sanitizedData.lastName).toBe('SANTOS');
    });

    test('should reject null or undefined input and return structured error', () => {
      const nullResult = dataEntryService.validateStudentDetails(null);
      const undefinedResult = dataEntryService.validateStudentDetails(undefined);
      
      expect(nullResult.isValid).toBe(false);
      expect(nullResult.errors).toContain('Student details are required');
      expect(undefinedResult.isValid).toBe(false);
      expect(undefinedResult.errors).toContain('Student details are required');
    });

    test('should reject empty object and identify all missing required fields', () => {
      const emptyData = {};
      const result = dataEntryService.validateStudentDetails(emptyData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([
        'Last Name is required',
        'First Name is required', 
        'Year is required',
        'Program is required',
        'Contact Number is required',
        'Evaluator is required'
      ]));
      // Middle name should be optional
      expect(result.errors).not.toContain('Middle Name is required');
    });

    test('should trim whitespace from all string fields and validate trimmed values', () => {
      const dataWithWhitespace = {
        lastName: '  SANTOS  ',
        firstName: '  MARIA  ',
        middleName: '  GARCIA  ',
        year: '4th Year',
        program: '  BS Computer Science  ',
        contactNumber: '  09171234567  ',
        evaluator: '  evaluator@xu.edu.ph  '
      };

      const result = dataEntryService.validateStudentDetails(dataWithWhitespace);
      
      expect(result.isValid).toBe(true);
      expect(result.sanitizedData.lastName).toBe('SANTOS');
      expect(result.sanitizedData.firstName).toBe('MARIA');
      expect(result.sanitizedData.program).toBe('BS Computer Science');
    });

    test('should reject fields that become empty after trimming', () => {
      const dataWithOnlyWhitespace = {
        lastName: '   ',
        firstName: 'MARIA',
        middleName: 'GARCIA',
        year: '4th Year',
        program: '   ',
        contactNumber: '09171234567',
        evaluator: 'evaluator@xu.edu.ph'
      };

      const result = dataEntryService.validateStudentDetails(dataWithOnlyWhitespace);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Last Name is required');
      expect(result.errors).toContain('Program is required');
    });

    test('should validate name fields contain only letters, spaces, hyphens, and apostrophes', () => {
      const validNames = {
        lastName: "O'CONNOR-SANTOS",
        firstName: 'MARIA ELENA',
        middleName: "D'ANGELO",
        year: '4th Year',
        program: 'BS Computer Science',
        contactNumber: '09171234567',
        evaluator: 'evaluator@xu.edu.ph'
      };

      const result = dataEntryService.validateStudentDetails(validNames);
      expect(result.isValid).toBe(true);
    });

    test('should reject names with numbers or special characters except hyphens and apostrophes', () => {
      const invalidCases = [
        { field: 'lastName', value: 'SANTOS123', error: 'Last Name can only contain letters, spaces, hyphens, and apostrophes' },
        { field: 'firstName', value: 'MARIA@', error: 'First Name can only contain letters, spaces, hyphens, and apostrophes' },
        { field: 'middleName', value: 'GARCIA#', error: 'Middle Name can only contain letters, spaces, hyphens, and apostrophes' },
        { field: 'lastName', value: 'SANTOS$CRUZ', error: 'Last Name can only contain letters, spaces, hyphens, and apostrophes' }
      ];

      invalidCases.forEach(({ field, value, error }) => {
        const testData = {
          lastName: 'SANTOS',
          firstName: 'MARIA',
          middleName: 'GARCIA',
          year: '4th Year',
          program: 'BS Computer Science',
          contactNumber: '09171234567',
          evaluator: 'evaluator@xu.edu.ph'
        };
        testData[field] = value;

        const result = dataEntryService.validateStudentDetails(testData);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(error);
      });
    });

    test('should validate year field against predefined options', () => {
      const validYears = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'];
      const invalidYears = ['First Year', '6th Year', 'Graduate', 'Senior', ''];

      validYears.forEach(year => {
        const testData = {
          lastName: 'SANTOS',
          firstName: 'MARIA',
          middleName: 'GARCIA',
          year: year,
          program: 'BS Computer Science',
          contactNumber: '09171234567',
          evaluator: 'evaluator@xu.edu.ph'
        };

        const result = dataEntryService.validateStudentDetails(testData);
        expect(result.isValid).toBe(true);
      });

      invalidYears.forEach(year => {
        const testData = {
          lastName: 'SANTOS',
          firstName: 'MARIA',
          middleName: 'GARCIA',
          year: year,
          program: 'BS Computer Science',
          contactNumber: '09171234567',
          evaluator: 'evaluator@xu.edu.ph'
        };

        const result = dataEntryService.validateStudentDetails(testData);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Year must be one of: 1st Year, 2nd Year, 3rd Year, 4th Year, 5th Year');
      });
    });

    test('should validate Philippine mobile number formats', () => {
      const validContacts = [
        '09171234567',    // Standard format - 11 digits
        '09181234567',    // Different network - 11 digits
        '09991234567'     // Another network - 11 digits
      ];

      const invalidContacts = [
        '091712345',      // Too short
        '0917123456789',  // Too long
        '08171234567',    // Invalid prefix
        'abcd1234567',    // Contains letters
        '09-17-123-4567', // With dashes
        '0917 123 4567',  // With spaces
        '',               // Empty
        '1234567890'      // Wrong format (10 digits)
      ];

      validContacts.forEach(contact => {
        const testData = {
          lastName: 'SANTOS',
          firstName: 'MARIA',
          middleName: 'GARCIA',
          year: '4th Year',
          program: 'BS Computer Science',
          contactNumber: contact,
          evaluator: 'evaluator@xu.edu.ph'
        };

        const result = dataEntryService.validateStudentDetails(testData);
        expect(result.isValid).toBe(true);
      });

      invalidContacts.forEach(contact => {
        const testData = {
          lastName: 'SANTOS',
          firstName: 'MARIA',
          middleName: 'GARCIA',
          year: '4th Year',
          program: 'BS Computer Science',
          contactNumber: contact,
          evaluator: 'evaluator@xu.edu.ph'
        };

        const result = dataEntryService.validateStudentDetails(testData);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid contact number format');
      });
    });

    test('should validate evaluator email against XU domains only', () => {
      const validEmails = [
        'evaluator@xu.edu.ph',
        'test.evaluator@xu.edu.ph',
        'admin@my.xu.edu.ph',
        'staff@xu.edu.ph'
      ];

      const invalidEmails = [
        'evaluator@gmail.com',    // Wrong domain
        'test@yahoo.com',         // Wrong domain
        'invalid-email',          // No @ symbol
        'test@xu.com',           // Wrong TLD
        'test@my.xu.com',        // Wrong TLD
        '',                       // Empty
        'test@'                   // Incomplete
      ];

      validEmails.forEach(email => {
        const testData = {
          lastName: 'SANTOS',
          firstName: 'MARIA',
          middleName: 'GARCIA',
          year: '4th Year',
          program: 'BS Computer Science',
          contactNumber: '09171234567',
          evaluator: email
        };

        const result = dataEntryService.validateStudentDetails(testData);
        expect(result.isValid).toBe(true);
      });

      invalidEmails.forEach(email => {
        const testData = {
          lastName: 'SANTOS',
          firstName: 'MARIA',
          middleName: 'GARCIA',
          year: '4th Year',
          program: 'BS Computer Science',
          contactNumber: '09171234567',
          evaluator: email
        };

        const result = dataEntryService.validateStudentDetails(testData);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Evaluator email must be from XU domain (@xu.edu.ph or @my.xu.edu.ph)');
      });
    });
  });

  describe('Requested Documents Validation - TDD Red Phase', () => {
    test('should validate document selection with quantities and return sanitized data', () => {
      const validDocuments = {
        documents: ['Transcript of Records', 'Diploma'],
        originalQuantities: [2, 1],
        authenticatedQuantities: [1, 0],
        otherDocuments: ''
      };

      const result = dataEntryService.validateRequestedDocuments(validDocuments);
      
      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('sanitizedData');
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.sanitizedData.totalDocuments).toBe(2);
      expect(result.sanitizedData.totalOriginalCopies).toBe(3);
      expect(result.sanitizedData.totalAuthenticatedCopies).toBe(1);
    });

    test('should require at least one document to be selected', () => {
      const noDocuments = {
        documents: [],
        originalQuantities: [],
        authenticatedQuantities: [],
        otherDocuments: ''
      };

      const result = dataEntryService.validateRequestedDocuments(noDocuments);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('At least one document must be selected');
    });

    test('should validate arrays have matching lengths', () => {
      const mismatchedArrays = {
        documents: ['Transcript of Records', 'Diploma'],
        originalQuantities: [2],  // Missing one quantity
        authenticatedQuantities: [1, 0],
        otherDocuments: ''
      };

      const result = dataEntryService.validateRequestedDocuments(mismatchedArrays);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Document arrays must have matching lengths');
    });

    test('should validate document types against predefined list', () => {
      const validDocumentTypes = [
        'Transcript of Records',
        'Diploma',
        'Certificate of Enrollment',
        'Certificate of Graduation',
        'Certificate of Good Moral Character',
        'Other'
      ];

      const invalidDocuments = {
        documents: ['Invalid Document Type', 'Transcript of Records'],
        originalQuantities: [1, 1],
        authenticatedQuantities: [0, 0],
        otherDocuments: ''
      };

      const result = dataEntryService.validateRequestedDocuments(invalidDocuments);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid document type: Invalid Document Type');
    });

    test('should validate quantity ranges (0-100 for each document)', () => {
      const invalidQuantities = [
        { original: [-1, 1], auth: [1, 0], error: 'Original quantities must be between 0 and 100' },
        { original: [101, 1], auth: [1, 0], error: 'Original quantities must be between 0 and 100' },
        { original: [1, 1], auth: [-1, 0], error: 'Authenticated quantities must be between 0 and 100' },
        { original: [1, 1], auth: [101, 0], error: 'Authenticated quantities must be between 0 and 100' }
      ];

      invalidQuantities.forEach(({ original, auth, error }) => {
        const testData = {
          documents: ['Transcript of Records', 'Diploma'],
          originalQuantities: original,
          authenticatedQuantities: auth,
          otherDocuments: ''
        };

        const result = dataEntryService.validateRequestedDocuments(testData);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(error);
      });
    });

    test('should require at least one copy (original or authenticated) per document', () => {
      const zeroCopies = {
        documents: ['Transcript of Records'],
        originalQuantities: [0],
        authenticatedQuantities: [0],
        otherDocuments: ''
      };

      const result = dataEntryService.validateRequestedDocuments(zeroCopies);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Each document must have at least 1 copy (original or authenticated)');
    });

    test('should require specification when "Other" document type is selected', () => {
      const otherWithoutSpec = {
        documents: ['Other'],
        originalQuantities: [1],
        authenticatedQuantities: [0],
        otherDocuments: ''
      };

      const result = dataEntryService.validateRequestedDocuments(otherWithoutSpec);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Other documents must be specified when "Other" is selected');

      const otherWithSpec = {
        documents: ['Other'],
        originalQuantities: [1],
        authenticatedQuantities: [0],
        otherDocuments: 'Certificate of Good Moral Character'
      };

      const validResult = dataEntryService.validateRequestedDocuments(otherWithSpec);
      expect(validResult.isValid).toBe(true);
    });

    test('should limit total copies per request to prevent abuse', () => {
      const tooManyCopies = {
        documents: ['Transcript of Records'],
        originalQuantities: [50],
        authenticatedQuantities: [51], // Total 101 copies
        otherDocuments: ''
      };

      const result = dataEntryService.validateRequestedDocuments(tooManyCopies);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Total copies per request cannot exceed 100');
    });
  });

  describe('Other Details Validation - TDD Red Phase', () => {
    test('should validate all other details and return structured result', () => {
      const validDetails = {
        controlNumber: '12345',
        amount: '150.00',
        dueDate: '2025-02-15',
        receiveOption: 'pickup',
        mailingAddress: '',
        emailAddress: 'student@my.xu.edu.ph',
        scannedAndEmail: false
      };

      const result = dataEntryService.validateOtherDetails(validDetails);
      
      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('sanitizedData');
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.sanitizedData.amount).toBe(150.00); // Converted to number
    });

    test('should accept control number if no existing control number found', () => {
      const detailsWithControl = {
        controlNumber: '12345',
        amount: '150.00',
        dueDate: '2025-02-15',
        receiveOption: 'pickup',
        mailingAddress: '',
        emailAddress: 'student@my.xu.edu.ph',
        scannedAndEmail: false
      };

      // Mock that control number doesn't exist
      jest.spyOn(dataEntryService, 'controlNumberExists').mockResolvedValue(false);

      const result = dataEntryService.validateOtherDetails(detailsWithControl);
      
      expect(result.isValid).toBe(true);
      expect(result.sanitizedData.controlNumber).toBe('12345');
    });

    test('should reject control number if existing control number found', () => {
      const detailsWithControl = {
        controlNumber: '12345',
        amount: '150.00',
        dueDate: '2025-02-15',
        receiveOption: 'pickup',
        mailingAddress: '',
        emailAddress: 'student@my.xu.edu.ph',
        scannedAndEmail: false
      };

      // Mock that control number already exists
      jest.spyOn(dataEntryService, 'controlNumberExists').mockResolvedValue(true);

      const result = dataEntryService.validateOtherDetails(detailsWithControl);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Control number already exists');
    });

    test('should validate control number format (5 digits)', () => {
      const invalidControlNumbers = [
        { control: '123', error: 'Control number must be 5 digits' },
        { control: '123456', error: 'Control number must be 5 digits' },
        { control: 'abcde', error: 'Control number must be 5 digits' },
        { control: '12a45', error: 'Control number must be 5 digits' }
      ];

      invalidControlNumbers.forEach(({ control, error }) => {
        const testData = {
          controlNumber: control,
          amount: '150.00',
          dueDate: '2025-02-15',
          receiveOption: 'pickup',
          mailingAddress: '',
          emailAddress: 'student@my.xu.edu.ph',
          scannedAndEmail: false
        };

        const result = dataEntryService.validateOtherDetails(testData);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(error);
      });
    });

    test('should validate amount format and range', () => {
      const amountTests = [
        { amount: '0', valid: true, parsed: 0 },
        { amount: '0.00', valid: true, parsed: 0 },
        { amount: '100', valid: true, parsed: 100 },
        { amount: '100.50', valid: true, parsed: 100.50 },
        { amount: '9999.99', valid: true, parsed: 9999.99 },
        { amount: '-100', valid: false, error: 'Amount must be 0 or positive' },
        { amount: 'abc', valid: false, error: 'Amount must be a valid number' },
        { amount: '100.999', valid: false, error: 'Amount cannot have more than 2 decimal places' },
        { amount: '10000', valid: false, error: 'Amount cannot exceed 9999.99' },
        { amount: '', valid: false, error: 'Amount is required' }
      ];

      amountTests.forEach(({ amount, valid, parsed, error }) => {
        const testData = {
          controlNumber: '12345',
          amount: amount,
          dueDate: '2025-02-15',
          receiveOption: 'pickup',
          mailingAddress: '',
          emailAddress: 'student@my.xu.edu.ph',
          scannedAndEmail: false
        };

        const result = dataEntryService.validateOtherDetails(testData);
        expect(result.isValid).toBe(valid);
        
        if (valid) {
          expect(result.sanitizedData.amount).toBe(parsed);
        } else {
          expect(result.errors).toContain(error);
        }
      });
    });

    test('should validate due date is not in the past and has correct format', () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const dateTests = [
        { date: today.toISOString().split('T')[0], valid: true },
        { date: tomorrow.toISOString().split('T')[0], valid: true },
        { date: yesterday.toISOString().split('T')[0], valid: false, error: 'Due date cannot be in the past' },
        { date: 'invalid-date', valid: false, error: 'Due date must be in YYYY-MM-DD format' },
        { date: '2025-13-01', valid: false, error: 'Due date must be a valid date' },
        { date: '', valid: false, error: 'Due date is required' }
      ];

      dateTests.forEach(({ date, valid, error }) => {
        const testData = {
          controlNumber: '12345',
          amount: '150.00',
          dueDate: date,
          receiveOption: 'pickup',
          mailingAddress: '',
          emailAddress: 'student@my.xu.edu.ph',
          scannedAndEmail: false
        };

        const result = dataEntryService.validateOtherDetails(testData);
        expect(result.isValid).toBe(valid);
        
        if (!valid) {
          expect(result.errors).toContain(error);
        }
      });
    });

    test('should validate receive option and enforce dependencies', () => {
      const receiveOptionTests = [
        {
          option: 'pickup',
          mailing: '',
          email: 'student@my.xu.edu.ph',
          valid: true
        },
        {
          option: 'mail',
          mailing: '123 Main St, Cagayan de Oro City',
          email: 'student@my.xu.edu.ph',
          valid: true
        },
        {
          option: 'mail',
          mailing: '',
          email: 'student@my.xu.edu.ph',
          valid: false,
          error: 'Mailing address is required for mail delivery'
        },
        {
          option: 'email',
          mailing: '',
          email: 'student@my.xu.edu.ph',
          valid: true
        },
        {
          option: 'email',
          mailing: '',
          email: '',
          valid: false,
          error: 'Email address is required for email delivery'
        },
        {
          option: 'invalid',
          mailing: '',
          email: 'student@my.xu.edu.ph',
          valid: false,
          error: 'Receive option must be one of: pickup, mail, email'
        }
      ];

      receiveOptionTests.forEach(({ option, mailing, email, valid, error }) => {
        const testData = {
          controlNumber: '12345',
          amount: '150.00',
          dueDate: '2025-02-15',
          receiveOption: option,
          mailingAddress: mailing,
          emailAddress: email,
          scannedAndEmail: false
        };

        const result = dataEntryService.validateOtherDetails(testData);
        expect(result.isValid).toBe(valid);
        
        if (!valid) {
          expect(result.errors).toContain(error);
        }
      });
    });
  });

  describe('Complete Request Creation - TDD Red Phase', () => {
    test('should create request when user has proper permissions', async () => {
      const completeRequestData = {
        studentDetails: {
          lastName: 'SANTOS',
          firstName: 'MARIA',
          middleName: 'GARCIA',
          year: '4th Year',
          program: 'BS Computer Science',
          contactNumber: '09171234567',
          evaluator: 'evaluator@xu.edu.ph'
        },
        requestedDocuments: {
          documents: ['Transcript of Records'],
          originalQuantities: [2],
          authenticatedQuantities: [1],
          otherDocuments: ''
        },
        otherDetails: {
          controlNumber: '12345',
          amount: '150.00',
          dueDate: '2025-02-15',
          receiveOption: 'pickup',
          mailingAddress: '',
          emailAddress: 'student@my.xu.edu.ph',
          scannedAndEmail: false
        },
        remarks: {
          comment: 'Rush processing needed',
          isPublic: true
        }
      };

      const userSession = {
        email: 'evaluator@xu.edu.ph',
        role: 'Evaluator',
        sessionId: 'session123'
      };

      const result = await dataEntryService.createRequest(completeRequestData, userSession);
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('data');
      expect(result.success).toBe(true);
      expect(result.data.trackingCode).toMatch(/^SANTOS_\d+$/);
      expect(result.data.status).toBe('Request Received');
      expect(result.data.controlNumber).toBe('12345');
      expect(result.data.createdBy).toBe('evaluator@xu.edu.ph');
      expect(result.data.createdAt).toBeDefined();
      expect(result.data.id).toBeDefined();
    });

    test('should aggregate all validation errors and reject request creation', async () => {
      const invalidRequestData = {
        studentDetails: {
          lastName: '',           // Missing
          firstName: 'MARIA123',  // Invalid format
          middleName: 'GARCIA',
          year: 'Invalid Year',   // Invalid option
          program: '',           // Missing
          contactNumber: '123',  // Invalid format
          evaluator: 'invalid@gmail.com' // Wrong domain
        },
        requestedDocuments: {
          documents: [],         // Empty
          originalQuantities: [],
          authenticatedQuantities: [],
          otherDocuments: ''
        },
        otherDetails: {
          controlNumber: '123',  // Invalid format
          amount: '-150.00',     // Negative
          dueDate: '2020-01-01', // Past date
          receiveOption: 'mail', // Requires mailing address
          mailingAddress: '',    // Missing for mail option
          emailAddress: 'student@my.xu.edu.ph',
          scannedAndEmail: false
        },
        remarks: {
          comment: 'A'.repeat(1001), // Too long
          isPublic: true
        }
      };

      const userSession = {
        email: 'evaluator@xu.edu.ph',
        role: 'Evaluator',
        sessionId: 'session123'
      };

      const result = await dataEntryService.createRequest(invalidRequestData, userSession);
      
      expect(result.success).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([
        'Last Name is required',
        'First Name can only contain letters, spaces, hyphens, and apostrophes',
        'Year must be one of: 1st Year, 2nd Year, 3rd Year, 4th Year, 5th Year',
        'Program is required',
        'Invalid contact number format',
        'Evaluator email must be from XU domain (@xu.edu.ph or @my.xu.edu.ph)',
        'At least one document must be selected',
        'Control number must be 5 digits',
        'Amount must be 0 or positive',
        'Due date cannot be in the past',
        'Mailing address is required for mail delivery',
        'Comment exceeds maximum length (1000 characters)'
      ]));
    });

    test('should enforce role-based permissions for request creation', async () => {
      const validRequestData = {
        studentDetails: {
          lastName: 'SANTOS',
          firstName: 'MARIA',
          middleName: 'GARCIA',
          year: '4th Year',
          program: 'BS Computer Science',
          contactNumber: '09171234567',
          evaluator: 'evaluator@xu.edu.ph'
        },
        requestedDocuments: {
          documents: ['Transcript of Records'],
          originalQuantities: [1],
          authenticatedQuantities: [0],
          otherDocuments: ''
        },
        otherDetails: {
          controlNumber: '12345',
          amount: '150.00',
          dueDate: '2025-02-15',
          receiveOption: 'pickup',
          mailingAddress: '',
          emailAddress: 'student@my.xu.edu.ph',
          scannedAndEmail: false
        },
        remarks: {
          comment: '',
          isPublic: true
        }
      };

      const unauthorizedRoles = [
        { email: 'intern@my.xu.edu.ph', role: 'Intern' },
        { email: 'student@my.xu.edu.ph', role: 'Student' },
        { email: 'assistant@my.xu.edu.ph', role: 'StudentAssistant' }
      ];

      for (const session of unauthorizedRoles) {
        const result = await dataEntryService.createRequest(validRequestData, session);
        
        expect(result.success).toBe(false);
        expect(result.error).toBe('INSUFFICIENT_PERMISSIONS');
        expect(result.message).toBe('You do not have permission to create requests');
      }

      // Authorized roles should succeed
      const authorizedRoles = [
        { email: 'evaluator@xu.edu.ph', role: 'Evaluator' },
        { email: 'registrar@xu.edu.ph', role: 'UniversityRegistrar' },
        { email: 'sysadmin@xu.edu.ph', role: 'SystemAdministrator' }
      ];

      for (const session of authorizedRoles) {
        const result = await dataEntryService.createRequest(validRequestData, session);
        expect(result.success).toBe(true);
      }
    });


  });

  describe('Request Status Management - TDD Red Phase', () => {
    test('should update request status with proper permissions and audit trail', async () => {
      const requestId = 'req_12345';
      const newStatus = 'Processing';
      
      const evaluatorSession = {
        email: 'evaluator@xu.edu.ph',
        role: 'Evaluator',
        sessionId: 'session123'
      };

      const result = await dataEntryService.updateRequestStatus(requestId, newStatus, evaluatorSession);
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('data');
      expect(result.success).toBe(true);
      expect(result.data.status).toBe(newStatus);
      expect(result.data.updatedBy).toBe('evaluator@xu.edu.ph');
      expect(result.data.updatedAt).toBeDefined();
      expect(result.data.statusHistory).toBeDefined();
    });

    test('should validate status transitions according to business rules', async () => {
      const requestId = 'req_12345';
      
      const evaluatorSession = {
        email: 'evaluator@xu.edu.ph',
        role: 'Evaluator',
        sessionId: 'session123'
      };

      const invalidTransitions = [
        { from: 'Request Received', to: 'Ready for Pickup', error: 'Cannot skip Processing status' },
        { from: 'Ready for Pickup', to: 'Request Received', error: 'Cannot move backwards in status' },
        { from: 'Processing', to: 'Invalid Status', error: 'Invalid status value' }
      ];

      for (const { from, to, error } of invalidTransitions) {
        // Mock current status
        jest.spyOn(dataEntryService, 'getRequestById').mockResolvedValue({ status: from });
        
        const result = await dataEntryService.updateRequestStatus(requestId, to, evaluatorSession);
        
        expect(result.success).toBe(false);
        expect(result.errors).toContain(error);
      }
    });

    test('should reject status updates from unauthorized roles', async () => {
      const requestId = 'req_12345';
      const newStatus = 'Processing';
      
      const unauthorizedSessions = [
        { email: 'intern@my.xu.edu.ph', role: 'Intern' },
        { email: 'student@my.xu.edu.ph', role: 'Student' }
      ];

      for (const session of unauthorizedSessions) {
        const result = await dataEntryService.updateRequestStatus(requestId, newStatus, session);
        
        expect(result.success).toBe(false);
        expect(result.error).toBe('INSUFFICIENT_PERMISSIONS');
        expect(result.message).toBe('You do not have permission to update request status');
      }
    });
  });


}); 