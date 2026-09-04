import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const vendor = await prisma.vendor.upsert({
    where: { id: "vendor-buddy-demo" },
    update: {
      businessName: "Amina's Kitchen",
      logoUrl: null,
      motto: "Homemade goodness, delivered with care.",
      whatsappNumber: "+2348012345678",
    },
    create: {
      id: "vendor-buddy-demo",
      businessName: "Amina's Kitchen",
      motto: "Homemade goodness, delivered with care.",
      whatsappNumber: "+2348012345678",
    },
  });

  await prisma.product.deleteMany({ where: { vendorId: vendor.id } });

  await prisma.product.createMany({
    data: [
      {
        vendorId: vendor.id,
        name: "Jollof Rice Tray",
        description: "Party-size tray of smoky jollof rice.",
        category: "Rice dishes",
        price: 18500,
        inStock: true,
      },
      {
        vendorId: vendor.id,
        name: "Peppered Chicken",
        description: "Spiced grilled chicken pieces.",
        category: "Proteins",
        price: 6500,
        inStock: true,
      },
      {
        vendorId: vendor.id,
        name: "Weekend Family Pack",
        description: "A rotating family-sized special.",
        category: null,
        price: 25000,
        inStock: false,
      },
    ],
  });

  console.log(`Seeded vendor ${vendor.businessName} with 3 products.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
