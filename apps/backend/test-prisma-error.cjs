const {
  PrismaClient,
  PrismaClientKnownRequestError,
} = require('@prisma/client');

// Test error construction
try {
  const error = new PrismaClientKnownRequestError('Test message', {
    code: 'P2025',
    clientVersion: '5.0.0',
  });
  console.log('Error created successfully:', error.message, error.code);
} catch (e) {
  console.error('Error creating:', e.message);
}
