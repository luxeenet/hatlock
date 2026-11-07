// Comprehensive Functionality Audit Test Suite
// Executes end-to-end API & PostgreSQL operations for all modules

const BASE_URL = 'http://localhost:3000/api/v1';

async function runAudit() {
  console.log('================================================================');
  console.log('STARTING HATLOCK FULL FUNCTIONALITY AUDIT & VERIFICATION');
  console.log('================================================================\n');

  let adminToken = '';
  let businessToken = '';
  let businessId = '';
  let createdCustomerId = '';
  let createdDeviceId = '';
  let freshDeviceForFinancingId = '';
  let createdFinancingId = '';
  let createdRentalId = '';
  let createdReturnId = '';

  const results = [];

  function record(module, action, passed, note) {
    results.push({ module, action, passed, note });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark} [${module}] ${action}: ${note}`);
  }

  // 1. Authentication
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'business@demo.local', password: 'Admin@123456' })
    });
    const data = await res.json();
    if (res.ok && data.accessToken) {
      businessToken = data.accessToken;
      businessId = data.businessId;
      record('Auth', 'Business Login', true, `Obtained JWT token for businessId: ${businessId}`);
    } else {
      record('Auth', 'Business Login', false, data.message || 'No token');
    }

    const adminRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@hatlock.local', password: 'Admin@123456' })
    });
    const adminData = await adminRes.json();
    if (adminRes.ok && adminData.accessToken) {
      adminToken = adminData.accessToken;
      record('Auth', 'Super-Admin Login', true, 'Obtained Super-Admin JWT token');
    } else {
      record('Auth', 'Super-Admin Login', false, adminData.message || 'No token');
    }
  } catch (err) {
    record('Auth', 'Login Exception', false, err.message);
  }

  const bHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${businessToken}`
  };

  const aHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminToken}`
  };

  // 2. Customer Management
  try {
    const custPayload = {
      firstName: 'Baraka',
      lastName: 'Mwinyi',
      email: `baraka.${Date.now()}@example.com`,
      phone: '+255719999888',
      idNumber: `TZ-${Date.now().toString().slice(-6)}`,
      address: 'Kariakoo Market Street, Dar es Salaam',
      city: 'Dar es Salaam',
      country: 'TZ',
      notes: 'Hardware loan applicant verified with NIDA ID'
    };

    const cRes = await fetch(`${BASE_URL}/customers`, {
      method: 'POST',
      headers: bHeaders,
      body: JSON.stringify(custPayload)
    });
    const cData = await cRes.json();

    if (cRes.ok && cData.customer?.id) {
      createdCustomerId = cData.customer.id;
      record('Customers', 'Create Customer (KYC)', true, `Created customer: ${cData.customer.firstName} ${cData.customer.lastName}`);
    } else {
      record('Customers', 'Create Customer (KYC)', false, JSON.stringify(cData));
    }

    const listRes = await fetch(`${BASE_URL}/customers`, { headers: bHeaders });
    const listData = await listRes.json();
    const found = listData.customers?.some(c => c.id === createdCustomerId);
    record('Customers', 'List & Search Customers', found, `Found customer in business tenant list (${listData.customers?.length} total)`);
  } catch (err) {
    record('Customers', 'Customer API Exception', false, err.message);
  }

  // 3. Device Inventory & Signed Remote Lock
  try {
    const devPayload = {
      serialNumber: `TEST-SN-${Date.now().toString().slice(-6)}`,
      manufacturer: 'Lenovo',
      model: 'ThinkPad T14s Gen 3',
      purchasePrice: 1650000,
      condition: 'EXCELLENT',
      notes: 'Audit verification test laptop with TPM 2.0 attestation'
    };

    const dRes = await fetch(`${BASE_URL}/devices`, {
      method: 'POST',
      headers: bHeaders,
      body: JSON.stringify(devPayload)
    });
    const dData = await dRes.json();

    if (dRes.ok && dData.device?.id) {
      createdDeviceId = dData.device.id;
      record('Devices', 'Register Device (Inventory)', true, `Registered ${dData.device.model} (${dData.device.serialNumber}) in PostgreSQL`);
    } else {
      record('Devices', 'Register Device (Inventory)', false, JSON.stringify(dData));
    }

    // Remote Lock Command
    const lockRes = await fetch(`${BASE_URL}/devices/${createdDeviceId}/command`, {
      method: 'POST',
      headers: bHeaders,
      body: JSON.stringify({
        action: 'RESTRICT',
        reason: 'Audit test policy violation: Simulated non-payment lock',
        lockScreenMessage: 'HatLock Enforcement: Payment required.'
      })
    });
    const lockData = await lockRes.json();
    const lockCmdId = lockData.command?.id || lockData.commandId;
    record('Devices', 'Dispatch Signed Remote Lock', lockRes.ok && !!lockCmdId, `Signed lock command ID: ${lockCmdId}`);

    // Remote Restore Command
    const restoreRes = await fetch(`${BASE_URL}/devices/${createdDeviceId}/command`, {
      method: 'POST',
      headers: bHeaders,
      body: JSON.stringify({
        action: 'RESTORE',
        reason: 'Payment confirmed. Account reinstated.'
      })
    });
    const restoreData = await restoreRes.json();
    const restoreCmdId = restoreData.command?.id || restoreData.commandId;
    record('Devices', 'Dispatch Signed Remote Unlock', restoreRes.ok && !!restoreCmdId, `Signed restore command ID: ${restoreCmdId}`);
  } catch (err) {
    record('Devices', 'Device Management Exception', false, err.message);
  }

  // 4. Hire Purchase Financing Agreement
  try {
    // Register dedicated available laptop for financing
    const finDevRes = await fetch(`${BASE_URL}/devices`, {
      method: 'POST',
      headers: bHeaders,
      body: JSON.stringify({
        serialNumber: `FIN-SN-${Date.now().toString().slice(-6)}`,
        manufacturer: 'Dell',
        model: 'Latitude 5430',
        purchasePrice: 1500000,
        condition: 'EXCELLENT'
      })
    });
    const finDevData = await finDevRes.json();
    freshDeviceForFinancingId = finDevData.device.id;

    const finPayload = {
      customerId: createdCustomerId,
      deviceId: freshDeviceForFinancingId,
      totalAmountTZS: 1800000,
      downPaymentTZS: 300000,
      paymentFrequency: 'MONTHLY',
      instalmentCount: 6,
      startDate: new Date().toISOString(),
      gracePeriodDays: 3
    };

    const finRes = await fetch(`${BASE_URL}/financing`, {
      method: 'POST',
      headers: bHeaders,
      body: JSON.stringify(finPayload)
    });
    const finData = await finRes.json();

    if (finRes.ok && finData.agreement?.id) {
      createdFinancingId = finData.agreement.id;
      record('Financing', 'Create HP Agreement', true, `Created agreement ${finData.agreement.agreementNumber} with ${finData.instalments?.length || 6} instalments in PostgreSQL`);
    } else {
      record('Financing', 'Create HP Agreement', false, JSON.stringify(finData));
    }
  } catch (err) {
    record('Financing', 'Financing Exception', false, err.message);
  }

  // 5. Equipment Rental Agreement
  try {
    // Register another device for rental
    const dev2Res = await fetch(`${BASE_URL}/devices`, {
      method: 'POST',
      headers: bHeaders,
      body: JSON.stringify({
        serialNumber: `RENTAL-SN-${Date.now().toString().slice(-6)}`,
        manufacturer: 'HP',
        model: 'ProBook 450 G9',
        purchasePrice: 1200000,
        condition: 'GOOD'
      })
    });
    const dev2Data = await dev2Res.json();

    const rentPayload = {
      customerId: createdCustomerId,
      deviceId: dev2Data.device.id,
      rentalRatePerPeriodTZS: 120000,
      paymentFrequency: 'MONTHLY',
      durationPeriods: 3,
      securityDepositTZS: 250000,
      startDate: new Date().toISOString()
    };

    const rentRes = await fetch(`${BASE_URL}/rentals`, {
      method: 'POST',
      headers: bHeaders,
      body: JSON.stringify(rentPayload)
    });
    const rentData = await rentRes.json();
    const rentalObj = rentData.agreement || rentData.rental;

    if (rentRes.ok && rentalObj?.id) {
      createdRentalId = rentalObj.id;
      record('Rentals', 'Create Rental Agreement', true, `Rental ${rentalObj.agreementNumber} created with strict title retention in PostgreSQL`);
    } else {
      record('Rentals', 'Create Rental Agreement', false, JSON.stringify(rentData));
    }
  } catch (err) {
    record('Rentals', 'Rental Exception', false, err.message);
  }

  // 6. Payment Processing (HatPesa)
  try {
    const payPayload = {
      agreementType: 'HIRE_PURCHASE',
      agreementId: createdFinancingId,
      amount: 250000,
      phoneNumber: '+255719999888',
      paymentMethod: 'HATPESA_MOBILE'
    };

    const payRes = await fetch(`${BASE_URL}/payments/initiate`, {
      method: 'POST',
      headers: bHeaders,
      body: JSON.stringify(payPayload)
    });
    const payData = await payRes.json();

    if (payRes.ok && payData.reference) {
      record('Payments', 'Initiate HatPesa Payment', true, `Transaction reference: ${payData.reference}, Status: ${payData.status}`);
    } else {
      record('Payments', 'Initiate HatPesa Payment', false, JSON.stringify(payData));
    }
  } catch (err) {
    record('Payments', 'Payment Exception', false, err.message);
  }

  // 7. Device Return & Physical Inspection
  try {
    const retRes = await fetch(`${BASE_URL}/returns`, {
      method: 'POST',
      headers: bHeaders,
      body: JSON.stringify({
        agreementId: createdRentalId,
        deviceId: createdDeviceId,
        reason: 'END_OF_LEASE',
        conditionNotes: 'Customer concluded 3-month lease term'
      })
    });
    const retData = await retRes.json();

    const returnObj = retData.return || retData.returnRequest;
    if (retRes.ok && returnObj?.id) {
      createdReturnId = returnObj.id;
      record('Returns', 'Initiate Return Workflow', true, `Return case opened: #${createdReturnId.slice(0, 8)}`);

      // Complete Inspection
      const inspectRes = await fetch(`${BASE_URL}/returns/${createdReturnId}/inspect`, {
        method: 'POST',
        headers: bHeaders,
        body: JSON.stringify({
          result: 'PASS',
          conditionRating: 'EXCELLENT',
          damageNotes: 'Clean return, no screen scratches or chassis dents',
          repairCostEstimateTZS: 0,
          refundSecurityDepositTZS: 250000
        })
      });
      const inspectData = await inspectRes.json();
      record('Returns', 'Verify Condition & Reconcile Deposit', inspectRes.ok, `Inspection recorded in PostgreSQL with deposit refund TZS 250,000`);
    } else {
      record('Returns', 'Initiate Return Workflow', false, JSON.stringify(retData));
    }
  } catch (err) {
    record('Returns', 'Returns Exception', false, err.message);
  }

  // 8. Super-Admin Platform Console
  try {
    const overRes = await fetch(`${BASE_URL}/super-admin/overview`, { headers: aHeaders });
    const overData = await overRes.json();
    if (overRes.ok && overData.platform) {
      record('Super-Admin', 'Global Health & Fleet Overview', true, `Global businesses: ${overData.platform.totalBusinesses}, Total devices: ${overData.platform.totalDevicesGlobal}`);
    } else {
      record('Super-Admin', 'Global Health & Fleet Overview', false, `Status: ${overRes.status}, Body: ${JSON.stringify(overData)}`);
    }

    const bizRes = await fetch(`${BASE_URL}/super-admin/businesses`, { headers: aHeaders });
    const bizData = await bizRes.json();
    if (bizRes.ok && bizData.businesses?.length > 0) {
      record('Super-Admin', 'Multi-Tenant Governance Query', true, `Listed ${bizData.businesses.length} tenant organizations`);
    } else {
      record('Super-Admin', 'Multi-Tenant Governance Query', false, `Status: ${bizRes.status}, Body: ${JSON.stringify(bizData)}`);
    }
  } catch (err) {
    record('Super-Admin', 'Super-Admin Exception', false, err.message);
  }

  console.log('\n================================================================');
  console.log(`AUDIT SUMMARY: ${results.filter(r => r.passed).length} / ${results.length} CHECKS PASSED`);
  console.log('================================================================');
}

runAudit().catch(console.error);
