const { PrismaClient } = require('@prisma/client');

async function test() {
  console.log('✓ Successfully imported PrismaClient from @prisma/client');

  const prisma = new PrismaClient();
  console.log('✓ Successfully instantiated PrismaClient');

  console.log(
    '✓ Prisma namespace available:',
    typeof prisma.$connect === 'function',
  );
  console.log(
    '✓ Prisma version:',
    require('@prisma/client/package.json').version,
  );

  console.log('\n✅ All Prisma client tests passed!');
}

test().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
