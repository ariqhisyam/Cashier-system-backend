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

  // Seed default Users (Admin & Karyawan)
  console.log('Seeding initial users...');
  const DEFAULT_USERS = [
    {
      name: 'Admin Matcha',
      key: 'admin123',
      role: 'ADMIN' as const,
      monthlySalary: 5000000,
      isActive: true,
    },
    {
      name: 'Kasir Utama',
      key: 'kyoto123',
      role: 'KARYAWAN' as const,
      monthlySalary: 2500000,
      isActive: true,
    },
    {
      name: 'Siti Rahma',
      key: 'kyoto456',
      role: 'KARYAWAN' as const,
      monthlySalary: 2200000,
      isActive: true,
    },
    {
      name: 'Budi Santoso',
      key: 'kyoto789',
      role: 'KARYAWAN' as const,
      monthlySalary: 2200000,
      isActive: true,
    },
    {
      name: 'Ahmad Fauzi',
      key: 'kyoto321',
      role: 'KARYAWAN' as const,
      monthlySalary: 2000000,
      isActive: true,
    },
  ];

  for (const user of DEFAULT_USERS) {
    const existing = await prisma.user.findUnique({
      where: { key: user.key },
    });

    if (!existing) {
      await prisma.user.create({
        data: user,
      });
      console.log(`Created user: ${user.name} (${user.role}) with key: ${user.key}`);
    } else {
      console.log(`User already exists: ${user.name} (${user.key})`);
    }
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
