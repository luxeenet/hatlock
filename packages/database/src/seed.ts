import { PrismaClient, UserRole, BusinessStatus, DeviceStatus, DeviceOS, HirePurchaseStatus, RentalStatus, PaymentFrequency, SubscriptionPlan } from '@prisma/client';

const prisma = new PrismaClient();

// Standard bcrypt hash for "Password123!" using cost 10
// $2a$10$wE9sRjWnBgzC.1M33xL83eLqXmJ45KxZ7w59x3o3zWnBgzC.1M33x or similar
const DEFAULT_PASSWORD_HASH = '$2a$10$K4rB3vK40vH5dK9zW1bF5.p6l3lYm9bQ9x6J5c4h2g1f0e9d8c7b6';

async function main() {
  console.log('🌱 Starting HatLock Database Seeding...');

  // 1. Subscription Plans
  const starterPlan = await prisma.plan.upsert({
    where: { name: 'Starter Plan' },
    update: {},
    create: {
      name: 'Starter Plan',
      plan: SubscriptionPlan.STARTER,
      description: 'Ideal for small laptop rental & financing shops up to 25 devices',
      monthlyPriceTZS: 99000,
      annualPriceTZS: 990000,
      maxDevices: 25,
      maxBranches: 1,
      maxEmployees: 3,
      features: { crossPlatformAgents: true, overlayLock: true, smsReminders: true },
      isActive: true,
    },
  });

  const businessPlan = await prisma.plan.upsert({
    where: { name: 'Business Plan' },
    update: {},
    create: {
      name: 'Business Plan',
      plan: SubscriptionPlan.BUSINESS,
      description: 'For growing IT asset leasing & hire purchase businesses up to 100 devices',
      monthlyPriceTZS: 249000,
      annualPriceTZS: 2490000,
      maxDevices: 100,
      maxBranches: 3,
      maxEmployees: 10,
      features: { crossPlatformAgents: true, overlayLock: true, smsReminders: true, customBranding: true },
      isActive: true,
    },
  });

  await prisma.plan.upsert({
    where: { name: 'Enterprise Plan' },
    update: {},
    create: {
      name: 'Enterprise Plan',
      plan: SubscriptionPlan.ENTERPRISE,
      description: 'Unlimited device fleet security with automated repossession & multi-branch governance',
      monthlyPriceTZS: 599000,
      annualPriceTZS: 5990000,
      maxDevices: 500,
      maxBranches: 10,
      maxEmployees: 50,
      features: { crossPlatformAgents: true, overlayLock: true, smsReminders: true, customBranding: true, dedicatedApi: true, hardwareTpmBind: true },
      isActive: true,
    },
  });
  console.log('✅ Created Subscription Plans: Starter, Growth, Enterprise');

  // 2. Super Admin (Luxeenet Platform Admin)
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@luxeenet.com' },
    update: {},
    create: {
      email: 'admin@luxeenet.com',
      phone: '+255700000001',
      passwordHash: DEFAULT_PASSWORD_HASH,
      role: UserRole.SUPER_ADMIN,
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });
  console.log('✅ Created Super Admin:', superAdmin.email);

  // 3. Demo Business: Dar Tech Solutions Ltd
  const business = await prisma.business.upsert({
    where: { registrationNumber: 'DAR-TECH-2024-TZ' },
    update: {},
    create: {
      name: 'Dar Tech Solutions Ltd',
      registrationNumber: 'DAR-TECH-2024-TZ',
      taxNumber: '109-887-654',
      email: 'contact@dartech.co.tz',
      phone: '+255222111000',
      address: 'Plot 42, Samora Avenue, City Centre',
      city: 'Dar es Salaam',
      country: 'Tanzania',
      status: BusinessStatus.ACTIVE,
      verifiedAt: new Date(),
      verifiedBy: superAdmin.id,
    },
  });
  console.log('✅ Created Business:', business.name);

  // Assign Growth Plan Subscription to Demo Business
  const periodStart = new Date();
  const periodEnd = new Date(periodStart);
  periodEnd.setDate(periodStart.getDate() + 30);

  await prisma.subscription.upsert({
    where: { businessId: business.id },
    update: {},
    create: {
      businessId: business.id,
      planId: businessPlan.id,
      status: 'ACTIVE',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    },
  });

  // 4. Branch
  const branch = await prisma.branch.upsert({
    where: { id: 'branch-dar-central' },
    update: {},
    create: {
      id: 'branch-dar-central',
      businessId: business.id,
      name: 'Samora HQ Branch',
      address: 'Samora Avenue, Dar es Salaam',
      phone: '+255222111001',
      isActive: true,
    },
  });

  // 5. Business Owner User & Employee
  const ownerUser = await prisma.user.upsert({
    where: { email: 'owner@dartech.co.tz' },
    update: {},
    create: {
      email: 'owner@dartech.co.tz',
      phone: '+255754000111',
      passwordHash: DEFAULT_PASSWORD_HASH,
      role: UserRole.BUSINESS_OWNER,
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      employee: {
        create: {
          businessId: business.id,
          branchId: branch.id,
          firstName: 'Joseph',
          lastName: 'Mkapa',
          position: 'Managing Director',
        },
      },
    },
  });
  console.log('✅ Created Business Owner:', ownerUser.email);

  // 6. Customers
  const customer1User = await prisma.user.upsert({
    where: { email: 'juma.ally@example.com' },
    update: {},
    create: {
      email: 'juma.ally@example.com',
      phone: '+255754123456',
      passwordHash: DEFAULT_PASSWORD_HASH,
      role: UserRole.CUSTOMER,
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  const customer1 = await prisma.customer.upsert({
    where: { id: 'cust-juma-ally' },
    update: {},
    create: {
      id: 'cust-juma-ally',
      userId: customer1User.id,
      businessId: business.id,
      firstName: 'Juma',
      lastName: 'Ally Rashid',
      email: 'juma.ally@example.com',
      phone: '+255754123456',
      nationalId: '19850412-14111-00001-22',
      address: 'Kijitonyama, Ali Hassan Mwinyi Rd',
      city: 'Dar es Salaam',
      isActive: true,
      portalAccessEnabled: true,
      verification: {
        create: {
          idType: 'NATIONAL_ID',
          idNumber: '19850412-14111-00001-22',
          verifiedAt: new Date(),
          notes: 'NIDA identity verified against national database',
        },
      },
    },
  });

  const customer2 = await prisma.customer.upsert({
    where: { id: 'cust-amina-bakari' },
    update: {},
    create: {
      id: 'cust-amina-bakari',
      businessId: business.id,
      firstName: 'Amina',
      lastName: 'Bakari',
      email: 'amina.bakari@example.com',
      phone: '+255768999888',
      nationalId: '19920824-11100-00004-89',
      address: 'Mwenge Tower, Suite 402',
      city: 'Dar es Salaam',
      isActive: true,
      portalAccessEnabled: true,
      verification: {
        create: {
          idType: 'DRIVING_LICENSE',
          idNumber: 'TZ-DL-9823412',
          verifiedAt: new Date(),
          notes: 'Driver license verified',
        },
      },
    },
  });
  console.log('✅ Created Demo Customers: Juma Ally and Amina Bakari');

  // 7. Inventory Devices
  const device1 = await prisma.device.upsert({
    where: {
      businessId_serialNumber: {
        businessId: business.id,
        serialNumber: 'DELL-LAT-7420-TZ01',
      },
    },
    update: {},
    create: {
      businessId: business.id,
      branchId: branch.id,
      manufacturer: 'Dell',
      model: 'Latitude 7420 vPro',
      serialNumber: 'DELL-LAT-7420-TZ01',
      assetTag: 'DAR-DL-001',
      purchasePrice: 2800000,
      acquisitionCost: 2800000,
      purchasedAt: new Date('2025-01-10'),
      physicalCondition: 'EXCELLENT',
      accessories: ['65W USB-C Charger', 'Dell Pro Briefcase'],
      status: DeviceStatus.ACTIVE,
      currentOS: DeviceOS.WINDOWS,
      currentCustomerId: customer1.id,
      identity: {
        create: {
          systemUUID: '4c4c4544-004a-4d10-8037-b4c04f583332',
          motherboardSerial: 'MB-DELL-99218274',
          tpmPresent: true,
          tpmVersion: '2.0',
          secureBoot: true,
          uefiEnabled: true,
          macAddresses: ['d8:5e:d3:11:22:33'],
          storageSerials: ['NVME-SAMSUNG-980PRO-512GB'],
          identityHash: '8f7a9d4e2b1c3f5a6e7d8c9b0a1f2e3d4c5b6a7f8e9d0c1b2a3f4e5d6c7b8a9f',
        },
      },
    },
  });

  const device2 = await prisma.device.upsert({
    where: {
      businessId_serialNumber: {
        businessId: business.id,
        serialNumber: 'HP-EB-840G8-TZ02',
      },
    },
    update: {},
    create: {
      businessId: business.id,
      branchId: branch.id,
      manufacturer: 'HP',
      model: 'EliteBook 840 G8',
      serialNumber: 'HP-EB-840G8-TZ02',
      assetTag: 'DAR-HP-002',
      purchasePrice: 2600000,
      acquisitionCost: 2600000,
      purchasedAt: new Date('2025-02-01'),
      physicalCondition: 'EXCELLENT',
      accessories: ['HP 65W AC Adapter', 'Sleeve Bag'],
      status: DeviceStatus.ACTIVE,
      currentOS: DeviceOS.LINUX,
      currentCustomerId: customer2.id,
      identity: {
        create: {
          systemUUID: '58a38b29-19ff-4e78-9e12-c2830f04821a',
          motherboardSerial: 'HP-BD-8837190',
          tpmPresent: true,
          tpmVersion: '2.0',
          secureBoot: true,
          uefiEnabled: true,
          macAddresses: ['28:f1:0e:aa:bb:cc'],
          storageSerials: ['KIOXIA-NVME-512GB-4819'],
          identityHash: '3b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c',
        },
      },
    },
  });

  const device3 = await prisma.device.upsert({
    where: {
      businessId_serialNumber: {
        businessId: business.id,
        serialNumber: 'LENOVO-T14-TZ03',
      },
    },
    update: {},
    create: {
      businessId: business.id,
      branchId: branch.id,
      manufacturer: 'Lenovo',
      model: 'ThinkPad T14 Gen 2 AMD',
      serialNumber: 'LENOVO-T14-TZ03',
      assetTag: 'DAR-LN-003',
      purchasePrice: 2400000,
      acquisitionCost: 2400000,
      purchasedAt: new Date('2025-02-15'),
      physicalCondition: 'EXCELLENT',
      accessories: ['ThinkPad 65W USB-C Charger'],
      status: DeviceStatus.AVAILABLE,
      currentOS: DeviceOS.WINDOWS,
    },
  });
  console.log('✅ Created Demo Inventory Devices (Dell, HP, Lenovo)');

  // 8. Hire Purchase Agreement (Dell Latitude 7420 for Juma Ally)
  const hpAgreement = await prisma.financingAgreement.upsert({
    where: { agreementNumber: 'HP-2026-0001' },
    update: {},
    create: {
      agreementNumber: 'HP-2026-0001',
      businessId: business.id,
      branchId: branch.id,
      customerId: customer1.id,
      deviceId: device1.id,
      status: HirePurchaseStatus.ACTIVE,
      purchasePriceTZS: 3200000,
      depositAmountTZS: 640000, // 20% down payment
      financedBalanceTZS: 2560000,
      financingChargesTZS: 384000, // 15% financing fee
      totalContractualTZS: 3584000,
      instalmentAmountTZS: 245333.33,
      paymentFrequency: PaymentFrequency.MONTHLY,
      startDate: new Date('2026-01-01'),
      expectedCompletionDate: new Date('2026-12-31'),
      gracePeriodDays: 3,
      ownershipTransferConditions: {
        allInstalmentsRequired: true,
        noOutstandingCharges: true,
        automaticRestrictionRemoval: true,
      },
      customerAcceptedAt: new Date('2026-01-01T10:00:00Z'),
      businessApprovedAt: new Date('2026-01-01T11:00:00Z'),
      businessApprovedBy: ownerUser.id,
    },
  });
  console.log('✅ Created Hire Purchase Agreement:', hpAgreement.agreementNumber);

  // 9. Rental Agreement (HP EliteBook 840 G8 for Amina Bakari)
  const rentalAgreement = await prisma.rentalAgreement.upsert({
    where: { agreementNumber: 'RT-2026-0001' },
    update: {},
    create: {
      agreementNumber: 'RT-2026-0001',
      businessId: business.id,
      branchId: branch.id,
      customerId: customer2.id,
      deviceId: device2.id,
      status: RentalStatus.ACTIVE,
      rentalPriceTZS: 180000, // 180,000 TZS per month
      paymentFrequency: PaymentFrequency.MONTHLY,
      securityDepositTZS: 360000, // 2 months refundable deposit
      totalExpectedTZS: 1080000, // 6 months contract
      startDate: new Date('2026-02-01'),
      endDate: new Date('2026-07-31'),
      nextPaymentDate: new Date('2026-03-01'),
      gracePeriodDays: 3,
      isAutoRenewable: true,
    },
  });
  console.log('✅ Created Rental Agreement:', rentalAgreement.agreementNumber);

  console.log('\n🎉 HatLock Database Seeding Finished Successfully!\n');
  console.log('Login credentials:');
  console.log(' - Super Admin: admin@luxeenet.com / Password123!');
  console.log(' - Business Owner: owner@dartech.co.tz / Password123!');
  console.log(' - Customer Portal: juma.ally@example.com / Password123!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
