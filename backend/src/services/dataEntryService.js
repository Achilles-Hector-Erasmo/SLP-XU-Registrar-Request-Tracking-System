const crypto = require('crypto');

class DataEntryService {
  // Constants for better maintainability
  static VALIDATION_CONSTANTS = {
    CONTROL_NUMBER_LENGTH: 5,
    MAX_AMOUNT: 9999.99,
    MAX_COMMENT_LENGTH: 1000,
    MAX_QUANTITY_PER_DOCUMENT: 100,
    MAX_TOTAL_COPIES: 100,
    VALID_YEARS: ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'],
    VALID_DOCUMENT_TYPES: [
      'Transcript of Records',
      'Diploma',
      'Certificate of Enrollment',
      'Certificate of Graduation',
      'Certificate of Good Moral Character',
      'Other'
    ],
    VALID_RECEIVE_OPTIONS: ['pickup', 'mail', 'email'],
    VALID_XU_DOMAINS: ['@xu.edu.ph', '@my.xu.edu.ph'],
    NAME_PATTERN: /^[A-Za-z\s\-']+$/,
    CONTROL_NUMBER_PATTERN: /^\d{5}$/,
    PHONE_PATTERN: /^09\d{9}$/,
    DATE_PATTERN: /^\d{4}-\d{2}-\d{2}$/,
    EMAIL_PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  };

  static ERROR_MESSAGES = {
    ACCESS_CONTROL_REQUIRED: 'AccessControlService is required',
    STUDENT_DETAILS_REQUIRED: 'Student details are required',
    DOCUMENTS_DATA_REQUIRED: 'Documents data is required',
    OTHER_DETAILS_REQUIRED: 'Other details are required',
    INSUFFICIENT_PERMISSIONS: 'You do not have permission to create requests',
    UPDATE_INSUFFICIENT_PERMISSIONS: 'You do not have permission to update request status',
    REQUEST_NOT_FOUND: 'Request not found'
  };

  constructor(accessControlService) {
    if (!accessControlService) {
      throw new Error(DataEntryService.ERROR_MESSAGES.ACCESS_CONTROL_REQUIRED);
    }
    this.accessControlService = accessControlService;
    this.requests = new Map(); // In-memory storage for demo (would be database in real app)
  }

  /**
   * Validate student details section
   */
  validateStudentDetails(studentData) {
    if (!this._isValidInput(studentData)) {
      return this._createValidationResult(false, [DataEntryService.ERROR_MESSAGES.STUDENT_DETAILS_REQUIRED], null);
    }

    const trimmedData = this._trimStudentData(studentData);
    const errors = [];

    // Validate required fields
    this._validateRequiredStudentFields(trimmedData, errors);
    
    // Validate field formats
    this._validateStudentNameFormats(trimmedData, errors);
    this._validateStudentYear(trimmedData, errors);
    this._validateStudentContactAndEvaluator(trimmedData, errors);

    const sanitizedData = errors.length === 0 ? this._sanitizeStudentData(trimmedData) : null;
    return this._createValidationResult(errors.length === 0, errors, sanitizedData);
  }

  /**
   * Validate requested documents section
   */
  validateRequestedDocuments(documentsData) {
    if (!documentsData) {
      return this._createValidationResult(false, [DataEntryService.ERROR_MESSAGES.DOCUMENTS_DATA_REQUIRED], null);
    }

    const { documents, originalQuantities, authenticatedQuantities, otherDocuments } = documentsData;
    const errors = [];

    // Early validation checks
    if (!this._validateDocumentsBasicRequirements(documents, originalQuantities, authenticatedQuantities, errors)) {
      return this._createValidationResult(false, errors, null);
    }

    const { totalOriginalCopies, totalAuthenticatedCopies } = this._validateDocumentDetails(
      documents, originalQuantities, authenticatedQuantities, otherDocuments, errors
    );

    const sanitizedData = errors.length === 0 
      ? this._createDocumentsSanitizedData(documents, originalQuantities, authenticatedQuantities, otherDocuments, totalOriginalCopies, totalAuthenticatedCopies)
      : null;

    return this._createValidationResult(errors.length === 0, errors, sanitizedData);
  }

  /**
   * Validate other details section
   */
  async validateOtherDetails(otherDetails) {
    if (!otherDetails) {
      return this._createValidationResult(false, [DataEntryService.ERROR_MESSAGES.OTHER_DETAILS_REQUIRED], null);
    }

    const errors = [];
    const sanitizedData = {};
    const { controlNumber, amount, dueDate, receiveOption, mailingAddress, emailAddress, scannedAndEmail } = otherDetails;

    // Validate each field
    await this._validateControlNumber(controlNumber, errors);
    this._validateAmount(amount, errors, sanitizedData);
    this._validateDueDate(dueDate, errors);
    this._validateReceiveOption(receiveOption, mailingAddress, emailAddress, errors);

    // Set sanitized data if no errors
    if (errors.length === 0) {
      Object.assign(sanitizedData, {
        controlNumber,
        dueDate,
        receiveOption,
        mailingAddress: mailingAddress ? mailingAddress.trim() : '',
        emailAddress: emailAddress ? emailAddress.trim() : '',
        scannedAndEmail: Boolean(scannedAndEmail)
      });
    }

    return this._createValidationResult(errors.length === 0, errors, sanitizedData);
  }

  /**
   * Create a new request
   */
  async createRequest(requestData, userSession) {
    if (!this._hasCreatePermissions(userSession)) {
      return this._createErrorResponse('INSUFFICIENT_PERMISSIONS', DataEntryService.ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS);
    }

    const validationResults = await this._validateAllRequestSections(requestData);
    const allErrors = this._collectAllValidationErrors(validationResults);

    if (allErrors.length > 0) {
      return { success: false, errors: allErrors };
    }

    const newRequest = this._buildNewRequest(validationResults, userSession);
    this.requests.set(newRequest.id, newRequest);

    return { success: true, data: newRequest };
  }

  /**
   * Update request status
   */
  async updateRequestStatus(requestId, newStatus, userSession) {
    if (!this._hasUpdateStatusPermissions(userSession)) {
      return this._createErrorResponse('INSUFFICIENT_PERMISSIONS', DataEntryService.ERROR_MESSAGES.UPDATE_INSUFFICIENT_PERMISSIONS);
    }

    const request = await this.getRequestById(requestId);
    if (!request) {
      return this._createErrorResponse('REQUEST_NOT_FOUND', DataEntryService.ERROR_MESSAGES.REQUEST_NOT_FOUND);
    }

    const statusValidation = this._validateStatusTransition(request.status, newStatus);
    if (!statusValidation.isValid) {
      return { success: false, errors: statusValidation.errors };
    }

    this._updateRequestWithNewStatus(request, newStatus, userSession);
    this.requests.set(requestId, request);

    return { success: true, data: request };
  }

  /**
   * Get request by ID
   */
  async getRequestById(requestId) {
    return this.requests.get(requestId) || null;
  }

  /**
   * Check if control number already exists
   */
  async controlNumberExists(controlNumber) {
    // In real implementation, this would query the database
    // For now, check in-memory storage
    for (const request of this.requests.values()) {
      if (request.controlNumber === controlNumber) {
        return true;
      }
    }
    return false;
  }

  /**
   * Generate unique 5-digit control number
   */
  generateControlNumber() {
    return Math.floor(10000 + Math.random() * 90000).toString();
  }

  /**
   * Generate tracking code
   */
  generateTrackingCode(lastName) {
    const controlNumber = this.generateControlNumber();
    return `${lastName.toUpperCase()}_${controlNumber}`;
  }

  /**
   * Sanitize and normalize input data
   */
  sanitizeInputData(data) {
    const sanitized = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        
        // Normalize names to uppercase
        if (['lastName', 'firstName', 'middleName'].includes(key)) {
          sanitized[key] = trimmed.toUpperCase();
        } else if (key === 'amount') {
          sanitized[key] = parseFloat(trimmed);
        } else {
          sanitized[key] = trimmed;
        }
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  /**
   * Validate remarks section
   */
  validateRemarks(remarks) {
    if (!remarks) {
      return this._createValidationResult(true, [], { comment: '', isPublic: false });
    }

    const errors = [];
    const { comment, isPublic } = remarks;

    if (comment && comment.length > DataEntryService.VALIDATION_CONSTANTS.MAX_COMMENT_LENGTH) {
      errors.push(`Comment exceeds maximum length (${DataEntryService.VALIDATION_CONSTANTS.MAX_COMMENT_LENGTH} characters)`);
    }

    if (typeof isPublic !== 'boolean') {
      errors.push('Privacy setting must be boolean');
    }

    const sanitizedData = errors.length === 0 ? { comment: comment || '', isPublic: Boolean(isPublic) } : null;
    return this._createValidationResult(errors.length === 0, errors, sanitizedData);
  }

  // ==================== PRIVATE HELPER METHODS ====================

  /**
   * Check if input is valid (not null/undefined)
   */
  _isValidInput(input) {
    return input !== null && input !== undefined;
  }

  /**
   * Create standardized validation result
   */
  _createValidationResult(isValid, errors, sanitizedData) {
    return { isValid, errors, sanitizedData };
  }

  /**
   * Create standardized error response
   */
  _createErrorResponse(error, message) {
    return { success: false, error, message };
  }

  /**
   * Trim all string fields in student data
   */
  _trimStudentData(studentData) {
    return {
      lastName: studentData.lastName ? studentData.lastName.trim() : '',
      firstName: studentData.firstName ? studentData.firstName.trim() : '',
      middleName: studentData.middleName ? studentData.middleName.trim() : '',
      year: studentData.year,
      program: studentData.program ? studentData.program.trim() : '',
      contactNumber: studentData.contactNumber ? studentData.contactNumber.trim() : '',
      evaluator: studentData.evaluator ? studentData.evaluator.trim() : ''
    };
  }

  /**
   * Validate required student fields
   */
  _validateRequiredStudentFields(trimmedData, errors) {
    const requiredFields = [
      { field: 'lastName', message: 'Last Name is required' },
      { field: 'firstName', message: 'First Name is required' },
      { field: 'year', message: 'Year is required' },
      { field: 'program', message: 'Program is required' },
      { field: 'contactNumber', message: 'Contact Number is required' },
      { field: 'evaluator', message: 'Evaluator is required' }
    ];

    requiredFields.forEach(({ field, message }) => {
      if (!trimmedData[field]) {
        errors.push(message);
      }
    });
  }

  /**
   * Validate student name formats
   */
  _validateStudentNameFormats(trimmedData, errors) {
    const nameFields = [
      { field: 'lastName', label: 'Last Name' },
      { field: 'firstName', label: 'First Name' },
      { field: 'middleName', label: 'Middle Name' }
    ];

    nameFields.forEach(({ field, label }) => {
      if (trimmedData[field] && !DataEntryService.VALIDATION_CONSTANTS.NAME_PATTERN.test(trimmedData[field])) {
        errors.push(`${label} can only contain letters, spaces, hyphens, and apostrophes`);
      }
    });
  }

  /**
   * Validate student year
   */
  _validateStudentYear(trimmedData, errors) {
    if (trimmedData.year && !DataEntryService.VALIDATION_CONSTANTS.VALID_YEARS.includes(trimmedData.year)) {
      errors.push(`Year must be one of: ${DataEntryService.VALIDATION_CONSTANTS.VALID_YEARS.join(', ')}`);
    }
  }

  /**
   * Validate student contact number and evaluator email
   */
  _validateStudentContactAndEvaluator(trimmedData, errors) {
    if (trimmedData.contactNumber && !this._validatePhilippineNumber(trimmedData.contactNumber)) {
      errors.push('Invalid contact number format');
    }

    if (trimmedData.evaluator && !this._validateXUEmail(trimmedData.evaluator)) {
      errors.push('Evaluator email must be from XU domain (@xu.edu.ph or @my.xu.edu.ph)');
    }
  }

  /**
   * Sanitize student data for successful validation
   */
  _sanitizeStudentData(trimmedData) {
    return {
      lastName: trimmedData.lastName.toUpperCase(),
      firstName: trimmedData.firstName.toUpperCase(),
      middleName: trimmedData.middleName.toUpperCase(),
      year: trimmedData.year,
      program: trimmedData.program,
      contactNumber: trimmedData.contactNumber,
      evaluator: trimmedData.evaluator.toLowerCase()
    };
  }

  /**
   * Validate basic requirements for documents
   */
  _validateDocumentsBasicRequirements(documents, originalQuantities, authenticatedQuantities, errors) {
    if (!documents || documents.length === 0) {
      errors.push('At least one document must be selected');
      return false;
    }

    if (documents.length !== originalQuantities.length || documents.length !== authenticatedQuantities.length) {
      errors.push('Document arrays must have matching lengths');
      return false;
    }

    return true;
  }

  /**
   * Validate individual document details
   */
  _validateDocumentDetails(documents, originalQuantities, authenticatedQuantities, otherDocuments, errors) {
    let totalOriginalCopies = 0;
    let totalAuthenticatedCopies = 0;

    for (let i = 0; i < documents.length; i++) {
      const docType = documents[i];
      const originalQty = originalQuantities[i];
      const authQty = authenticatedQuantities[i];

      this._validateSingleDocument(docType, originalQty, authQty, errors);
      
      totalOriginalCopies += originalQty;
      totalAuthenticatedCopies += authQty;
    }

    this._validateTotalCopies(totalOriginalCopies, totalAuthenticatedCopies, errors);
    this._validateOtherDocumentsSpecification(documents, otherDocuments, errors);

    return { totalOriginalCopies, totalAuthenticatedCopies };
  }

  /**
   * Validate a single document entry
   */
  _validateSingleDocument(docType, originalQty, authQty, errors) {
    if (!DataEntryService.VALIDATION_CONSTANTS.VALID_DOCUMENT_TYPES.includes(docType)) {
      errors.push(`Invalid document type: ${docType}`);
    }

    if (originalQty < 0 || originalQty > DataEntryService.VALIDATION_CONSTANTS.MAX_QUANTITY_PER_DOCUMENT) {
      errors.push(`Original quantities must be between 0 and ${DataEntryService.VALIDATION_CONSTANTS.MAX_QUANTITY_PER_DOCUMENT}`);
    }

    if (authQty < 0 || authQty > DataEntryService.VALIDATION_CONSTANTS.MAX_QUANTITY_PER_DOCUMENT) {
      errors.push(`Authenticated quantities must be between 0 and ${DataEntryService.VALIDATION_CONSTANTS.MAX_QUANTITY_PER_DOCUMENT}`);
    }

    if (originalQty + authQty === 0) {
      errors.push('Each document must have at least 1 copy (original or authenticated)');
    }
  }

  /**
   * Validate total copies limit
   */
  _validateTotalCopies(totalOriginalCopies, totalAuthenticatedCopies, errors) {
    if (totalOriginalCopies + totalAuthenticatedCopies > DataEntryService.VALIDATION_CONSTANTS.MAX_TOTAL_COPIES) {
      errors.push(`Total copies per request cannot exceed ${DataEntryService.VALIDATION_CONSTANTS.MAX_TOTAL_COPIES}`);
    }
  }

  /**
   * Validate other documents specification
   */
  _validateOtherDocumentsSpecification(documents, otherDocuments, errors) {
    if (documents.includes('Other')) {
      if (!otherDocuments || otherDocuments.trim() === '') {
        errors.push('Other documents must be specified when "Other" is selected');
      }
    }
  }

  /**
   * Create sanitized data for documents
   */
  _createDocumentsSanitizedData(documents, originalQuantities, authenticatedQuantities, otherDocuments, totalOriginalCopies, totalAuthenticatedCopies) {
    return {
      documents,
      originalQuantities,
      authenticatedQuantities,
      otherDocuments: otherDocuments ? otherDocuments.trim() : '',
      totalDocuments: documents.length,
      totalOriginalCopies,
      totalAuthenticatedCopies
    };
  }

  /**
   * Validate control number
   */
  async _validateControlNumber(controlNumber, errors) {
    if (!controlNumber || controlNumber.trim() === '') {
      errors.push('Control number is required');
      return;
    }

    if (!DataEntryService.VALIDATION_CONSTANTS.CONTROL_NUMBER_PATTERN.test(controlNumber.toString())) {
      errors.push('Control number must be 5 digits');
      return;
    }

    const exists = await this.controlNumberExists(controlNumber);
    if (exists) {
      errors.push('Control number already exists');
    }
  }

  /**
   * Validate amount
   */
  _validateAmount(amount, errors, sanitizedData) {
    if (!amount || amount.toString().trim() === '') {
      errors.push('Amount is required');
      return;
    }

    const amountStr = amount.toString().trim();
    const amountNum = parseFloat(amountStr);
    
    if (isNaN(amountNum)) {
      errors.push('Amount must be a valid number');
    } else if (amountNum < 0) {
      errors.push('Amount must be 0 or positive');
    } else if (amountNum > DataEntryService.VALIDATION_CONSTANTS.MAX_AMOUNT) {
      errors.push(`Amount cannot exceed ${DataEntryService.VALIDATION_CONSTANTS.MAX_AMOUNT}`);
    } else if (amountStr.includes('.') && amountStr.split('.')[1].length > 2) {
      errors.push('Amount cannot have more than 2 decimal places');
    } else {
      sanitizedData.amount = amountNum;
    }
  }

  /**
   * Validate due date
   */
  _validateDueDate(dueDate, errors) {
    if (!dueDate || dueDate.trim() === '') {
      errors.push('Due date is required');
      return;
    }

    if (!DataEntryService.VALIDATION_CONSTANTS.DATE_PATTERN.test(dueDate)) {
      errors.push('Due date must be in YYYY-MM-DD format');
      return;
    }

    const date = new Date(dueDate);
    if (isNaN(date.getTime())) {
      errors.push('Due date must be a valid date');
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    
    if (date < today) {
      errors.push('Due date cannot be in the past');
    }
  }

  /**
   * Validate receive option and its dependencies
   */
  _validateReceiveOption(receiveOption, mailingAddress, emailAddress, errors) {
    if (!receiveOption || !DataEntryService.VALIDATION_CONSTANTS.VALID_RECEIVE_OPTIONS.includes(receiveOption)) {
      errors.push(`Receive option must be one of: ${DataEntryService.VALIDATION_CONSTANTS.VALID_RECEIVE_OPTIONS.join(', ')}`);
      return;
    }

    if (receiveOption === 'mail' && (!mailingAddress || mailingAddress.trim() === '')) {
      errors.push('Mailing address is required for mail delivery');
    }

    if (receiveOption === 'email' && (!emailAddress || emailAddress.trim() === '')) {
      errors.push('Email address is required for email delivery');
    }
  }

  /**
   * Check if user has create permissions
   */
  _hasCreatePermissions(userSession) {
    return this.accessControlService.hasPermission(userSession.role, 'create_requests');
  }

  /**
   * Check if user has update status permissions
   */
  _hasUpdateStatusPermissions(userSession) {
    return this.accessControlService.hasPermission(userSession.role, 'update_request_status');
  }

  /**
   * Validate all request sections
   */
  async _validateAllRequestSections(requestData) {
    return {
      student: this.validateStudentDetails(requestData.studentDetails),
      documents: this.validateRequestedDocuments(requestData.requestedDocuments),
      otherDetails: await this.validateOtherDetails(requestData.otherDetails),
      remarks: this.validateRemarks(requestData.remarks)
    };
  }

  /**
   * Collect all validation errors
   */
  _collectAllValidationErrors(validationResults) {
    return [
      ...validationResults.student.errors,
      ...validationResults.documents.errors,
      ...validationResults.otherDetails.errors,
      ...validationResults.remarks.errors
    ];
  }

  /**
   * Build new request object
   */
  _buildNewRequest(validationResults, userSession) {
    const requestId = `req_${crypto.randomBytes(8).toString('hex')}`;
    const trackingCode = this.generateTrackingCode(validationResults.student.sanitizedData.lastName);
    const now = new Date().toISOString();

    return {
      id: requestId,
      trackingCode,
      status: 'Request Received',
      controlNumber: validationResults.otherDetails.sanitizedData.controlNumber,
      studentDetails: validationResults.student.sanitizedData,
      requestedDocuments: validationResults.documents.sanitizedData,
      otherDetails: validationResults.otherDetails.sanitizedData,
      remarks: validationResults.remarks.sanitizedData,
      createdBy: userSession.email,
      createdAt: now,
      updatedAt: now,
      statusHistory: [{
        status: 'Request Received',
        updatedBy: userSession.email,
        updatedAt: now
      }]
    };
  }

  /**
   * Validate status transition
   */
  _validateStatusTransition(currentStatus, newStatus) {
    const validStatuses = ['Request Received', 'Processing', 'Ready for Pickup'];
    
    if (!validStatuses.includes(newStatus)) {
      return { isValid: false, errors: ['Invalid status value'] };
    }

    const statusOrder = {
      'Request Received': 0,
      'Processing': 1,
      'Ready for Pickup': 2
    };

    const currentStatusOrder = statusOrder[currentStatus];
    const newStatusOrder = statusOrder[newStatus];

    if (newStatusOrder < currentStatusOrder) {
      return { isValid: false, errors: ['Cannot move backwards in status'] };
    }

    if (newStatusOrder > currentStatusOrder + 1) {
      return { isValid: false, errors: ['Cannot skip Processing status'] };
    }

    return { isValid: true, errors: [] };
  }

  /**
   * Update request with new status
   */
  _updateRequestWithNewStatus(request, newStatus, userSession) {
    const now = new Date().toISOString();
    request.status = newStatus;
    request.updatedBy = userSession.email;
    request.updatedAt = now;
    request.statusHistory.push({
      status: newStatus,
      updatedBy: userSession.email,
      updatedAt: now
    });
  }

  /**
   * Validate Philippine mobile number - strictly 11 digits
   */
  _validatePhilippineNumber(number) {
    const cleanNumber = number.replace(/[\s\-\(\)]/g, '');
    
    // Only accept standard format: 09XXXXXXXXX (exactly 11 digits)
    return DataEntryService.VALIDATION_CONSTANTS.PHONE_PATTERN.test(cleanNumber);
  }

  /**
   * Validate XU email domain
   */
  _validateXUEmail(email) {
    if (!DataEntryService.VALIDATION_CONSTANTS.EMAIL_PATTERN.test(email)) {
      return false;
    }
    
    return DataEntryService.VALIDATION_CONSTANTS.VALID_XU_DOMAINS.some(domain => 
      email.toLowerCase().endsWith(domain)
    );
  }
}

module.exports = { DataEntryService }; 