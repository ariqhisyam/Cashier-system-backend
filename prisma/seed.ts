import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_PRODUCTS = [
  {
    name: 'Pink Berry',
    price: 17000,
    stock: 50,
    imageUrl: '/matcha-latte.jpg',
    rawMaterialCost: 6419,
    isActive: true,
  },
  {
    name: 'Matcha',
    price: 15000,
    stock: 50,
    imageUrl: '/hojicha-latte.jpg',
    rawMaterialCost: 5033,
    isActive: true,
  },
  {
    name: 'Matcha Latte',
    price: 17000,
    stock: 50,
    imageUrl: '/matcha-cake.jpg',
    rawMaterialCost: 6540,
    isActive: true,
  },
  {
    name: 'Seasalt',
    price: 20000,
    stock: 50,
    imageUrl: '/matcha-ice-cream.jpg',
    rawMaterialCost: 9423,
    isActive: true,
  },
  {
    name: 'Coconut',
    price: 18000,
    stock: 50,
    imageUrl: '/matcha-cookie.jpg',
    rawMaterialCost: 7832,
    isActive: true,
  },
];

async function main() {
  console.log('Seeding initial products...');

  for (const prod of DEFAULT_PRODUCTS) {
    const existing = await prisma.product.findFirst({
      where: { name: prod.name },
    });

    if (!existing) {
      await prisma.product.create({
        data: prod,
      });
      console.log(`Created product: ${prod.name}`);
    } else {
      console.log(`Product already exists: ${prod.name}`);
    }
  }

  // Seed default QRIS URL setting if not exists
  const qrisSetting = await prisma.setting.findUnique({
    where: { key: 'qris_image_url' },
  });

  if (!qrisSetting) {
    await prisma.setting.create({
      data: {
        key: 'qris_image_url',
        value: '/qris.jpg',
      },
    });
    console.log('Created default QRIS image setting');
  }

  console.log('Seeding finished successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
