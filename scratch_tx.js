const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const txs = await prisma.transaction.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { items: true },
  });
  console.log('Total transactions in DB:', txs.length);
  for (const t of txs) {
    console.log({
      id: t.id,
      cashierId: t.cashierId,
      cashierName: t.cashierName,
      paymentMethod: t.paymentMethod,
      total: t.total,
      createdAt: t.createdAt,
      items: t.items.map((i) => ({ name: i.productName, qty: i.quantity })),
    });
  }

  const users = await prisma.user.findMany();
  console.log('Users in DB:');
  for (const u of users) {
    console.log({ id: u.id, name: u.name, role: u.role, key: u.key });
  }
}

main().finally(() => prisma.$disconnect());
