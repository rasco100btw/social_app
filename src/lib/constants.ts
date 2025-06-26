export const UPLOAD_CONSTRAINTS = {
  IMAGE: {
    formats: ['image/jpeg', 'image/png'],
    maxSize: 5 * 1024 * 1024, // 5MB
    dimensions: {
      min: { width: 200, height: 200 },
      max: { width: 4096, height: 4096 }
    },
    naming: {
      pattern: '[user-id]/[timestamp]-[original-name]',
      allowed: /^[a-zA-Z0-9-_./]+$/
    }
  },
  VIDEO: {
    formats: ['video/mp4', 'video/webm'],
    maxSize: 100 * 1024 * 1024, // 100MB
    dimensions: {
      max: { width: 1920, height: 1080 }
    },
    duration: {
      max: 300 // 5 minutes in seconds
    },
    naming: {
      pattern: '[user-id]/[timestamp]-[original-name]',
      allowed: /^[a-zA-Z0-9-_./]+$/
    }
  }
} as const;

export const METADATA_REQUIREMENTS = {
  required: ['title', 'description'],
  optional: ['tags', 'location', 'captureDate'],
  copyright: {
    required: true,
    options: ['all-rights-reserved', 'cc-by', 'cc-by-sa', 'cc0']
  }
} as const;

export const ERROR_MESSAGES = {
  FORMAT: 'Unsupported file format. Please upload:',
  SIZE: 'File exceeds maximum size limit:',
  DIMENSIONS: 'Image dimensions must be between:',
  DURATION: 'Video duration cannot exceed:',
  COPYRIGHT: 'Please specify copyright information',
  METADATA: 'Required metadata fields missing:'
} as const;