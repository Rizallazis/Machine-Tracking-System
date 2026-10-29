import { app } from '../app';
import http from 'http';
import {
  MachineStatus,
  MachineCondition,
  UserRole,
  MovementStatus,
  ConditionType
} from '@machine-tracking/shared';
import { getSheetsRepository } from '../repositories/sheets-client';
import { RecoveryJob } from '../jobs/recovery.job';

let server: http.Server;
const PORT = 5555;
const BASE_URL = `http://localhost:${PORT}/api/v1`;

async function fetchJson(endpoint: string, options: RequestInit = {}): Promise<{ status: number; body: any; headers: Headers }> {
  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const contentType = res.headers.get('content-type') || '';
  let body: any;
  if (contentType.includes('application/json')) {
    body = await res.json();
  } else {
    body = await res.text();
  }
  return { status: res.status, body, headers: res.headers };
}

async function runTests() {
  console.log('🧪 Memulai Pengujian Otomatis Sistem Skenario T01 - T20...');

  // Start temporary test server
  await new Promise<void>(resolve => {
    server = app.listen(PORT, () => resolve());
  });

  let adminToken = '';
  let picToken = '';
  let testsPassed = 0;
  let totalTests = 0;
  const adminEmail = process.env.TEST_ADMIN_EMAIL || process.env.INITIAL_ADMIN_EMAIL;
  const adminPassword = process.env.TEST_ADMIN_PASSWORD || process.env.INITIAL_ADMIN_PASSWORD;
  const picEmail = process.env.TEST_PIC_EMAIL;
  const picPassword = process.env.TEST_PIC_PASSWORD;
  const machineQrToken = process.env.TEST_MACHINE_QR_TOKEN;

  if (!adminEmail || !adminPassword || !picEmail || !picPassword || !machineQrToken) {
    throw new Error('Set TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, TEST_PIC_EMAIL, TEST_PIC_PASSWORD, and TEST_MACHINE_QR_TOKEN to run integration tests.');
  }

  function assert(condition: boolean, scenarioId: string, desc: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ [${scenarioId}] PASS: ${desc}`);
      testsPassed++;
    } else {
      console.error(`❌ [${scenarioId}] FAIL: ${desc}`);
    }
  }

  try {
    // T01: Login pengguna aktif
    const resT01 = await fetchJson('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: adminEmail, password: adminPassword })
    });
    assert(resT01.status === 200 && resT01.body.success && resT01.body.token, 'T01', 'Login pengguna aktif berhasil mendapatkan token');
    adminToken = resT01.body.token;

    // Login PIC user for role checks
    const resPicLogin = await fetchJson('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: picEmail, password: picPassword })
    });
    picToken = resPicLogin.body.token;

    // T02: Login pengguna nonaktif
    const repo = getSheetsRepository();
    // Temporarily insert inactive user
    const inactiveUser = {
      User_ID: 'USR-INACTIVE',
      User_Name: 'Pengguna Nonaktif',
      Login_Email: 'inactive@esgi.co.id',
      Role_ID: UserRole.PIC,
      Department: 'Sewing',
      Active: false,
      Created_At: new Date().toISOString()
    };
    await repo.insertUser(inactiveUser);
    const resT02 = await fetchJson('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'inactive@esgi.co.id' })
    });
    assert(resT02.status === 400 && resT02.body.message.includes('dinonaktifkan'), 'T02', 'Login pengguna nonaktif ditolak sistem');
    const resT03 = await fetchJson(`/qr/${encodeURIComponent(machineQrToken)}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(resT03.status === 200 && resT03.body.data.Machine_ID === 'MC-000001', 'T03', 'Scan QR valid menampilkan data mesin');

    // T04: Scan QR tidak terdaftar
    const resT04 = await fetchJson('/qr/QR-INVALID-999', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(resT04.status === 404, 'T04', 'Scan QR tidak terdaftar ditolak dengan pesan error 404');

    // T05: Registrasi mesin baru
    const resT05 = await fetchJson('/machines', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        machineName: 'Mesin Overdeck Kansai',
        categoryId: 'CAT-001',
        brand: 'KANSAI',
        model: 'W6000',
        serialNumber: 'KS-999123',
        currentLocationId: 'LOC-0001',
        currentPicId: 'PIC-0003'
      })
    });
    assert(resT05.status === 201 && resT05.body.data.Machine_ID.startsWith('MC-'), 'T05', 'Registrasi mesin baru berhasil disimpan dengan ID unik');
    const newMachineId = resT05.body.data.Machine_ID;

    // T06: ID mesin duplikat (dicoba insert langsung ke repo)
    let duplicateRejected = false;
    try {
      await repo.insertMachine(resT05.body.data);
    } catch {
      duplicateRejected = true;
    }
    assert(duplicateRejected, 'T06', 'Pendaftaran ID mesin duplikat berhasil ditolak repository');

    // T07: Pindah ke lokasi valid
    const requestIdT07 = `test-req-${Date.now()}-1`;
    const resT07 = await fetchJson('/movements', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        machineId: 'MC-000001',
        toLocationId: 'LOC-0002',
        newPicId: 'PIC-0004',
        reason: 'Pemindahan ke Line 02 untuk tes produksi',
        requestId: requestIdT07
      })
    });
    assert(resT07.status === 200 && resT07.body.status === MovementStatus.COMPLETED && resT07.body.currentLocationId === 'LOC-0002', 'T07', 'Perpindahan ke lokasi valid berhasil dan status COMPLETED');

    // T08: Pindah ke lokasi nonaktif
    const inactiveLoc = {
      Location_ID: 'LOC-INACTIVE',
      Building: 'Gedung Lama',
      Floor: '1',
      Department: 'Sewing',
      Area: 'Zona B',
      Line: '-',
      Position_Code: '-',
      Location_Name: 'Lokasi Tutup',
      Active: false,
      Notes: ''
    };
    await repo.insertLocation(inactiveLoc);
    const resT08 = await fetchJson('/movements', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        machineId: 'MC-000001',
        toLocationId: 'LOC-INACTIVE',
        newPicId: 'PIC-0004',
        reason: 'Coba pindah ke lokasi tutup',
        requestId: `test-req-${Date.now()}-inactive`
      })
    });
    assert(resT08.status === 400 && resT08.body.message.includes('tidak aktif'), 'T08', 'Pindah ke lokasi nonaktif ditolak sistem');

    // T09: Uji dua transaksi paralel pada mesin yang sama (concurrency lock)
    const reqIdParallel1 = `test-p1-${Date.now()}`;
    const reqIdParallel2 = `test-p2-${Date.now()}`;
    const [p1, p2] = await Promise.all([
      fetchJson('/movements', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          machineId: 'MC-000002',
          toLocationId: 'LOC-0003',
          newPicId: 'PIC-0001',
          reason: 'Paralel 1',
          requestId: reqIdParallel1
        })
      }),
      fetchJson('/movements', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          machineId: 'MC-000002',
          toLocationId: 'LOC-0004',
          newPicId: 'PIC-0001',
          reason: 'Paralel 2',
          requestId: reqIdParallel2
        })
      })
    ]);
    const mc2 = await repo.getMachineById('MC-000002');
    assert((p1.body.success && p2.body.success) && (mc2?.Current_Location_ID === 'LOC-0003' || mc2?.Current_Location_ID === 'LOC-0004'), 'T09', 'Transaksi paralel mesin ditangani dengan mutex berurutan tanpa corrupt');

    // T10: Request dikirim ulang dengan requestId sama (Idempotensi)
    const resT10 = await fetchJson('/movements', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        machineId: 'MC-000001',
        toLocationId: 'LOC-0002',
        newPicId: 'PIC-0004',
        reason: 'Kirim ulang request yang sama',
        requestId: requestIdT07 // Same ID as T07
      })
    });
    assert(resT10.status === 200 && resT10.body.movementId === resT07.body.movementId && resT10.body.message.includes('idempotent'), 'T10', 'Request ID yang sama mengembalikan hasil transaksi lama (tidak membuat duplikat)');

    // T11: Pemulihan transaksi PENDING
    const pendingMov = {
      Movement_ID: 'MOV-TEST-PENDING',
      Machine_ID: 'MC-000003',
      From_Location_ID: 'LOC-0002',
      To_Location_ID: 'LOC-0005',
      Old_PIC_ID: 'PIC-0004',
      New_PIC_ID: 'PIC-0001',
      Movement_DateTime: new Date().toISOString(),
      Movement_Reason: 'Uji Recovery Job',
      Requested_By: 'USR-001',
      Approved_By: '',
      Status: MovementStatus.PENDING,
      Notes: 'Stuck pending test',
      Request_ID: 'test-pending-req'
    };
    await repo.insertMovement(pendingMov);
    // Simulate master was already updated before crash
    await repo.updateMachine('MC-000003', { Current_Location_ID: 'LOC-0005' });
    await RecoveryJob.runReconciliation();
    const recoveredMov = await repo.getMovementById('MOV-TEST-PENDING');
    assert(recoveredMov?.Status === MovementStatus.COMPLETED, 'T11', 'Transaksi PENDING berhasil dipulihkan oleh recovery job');

    // T12: User biasa (PIC) membuka fungsi admin (POST /categories)
    const resT12 = await fetchJson('/categories', {
      method: 'POST',
      headers: { Authorization: `Bearer ${picToken}` },
      body: JSON.stringify({ categoryName: 'Test Unauthorized', department: 'Sewing' })
    });
    assert(resT12.status === 403, 'T12', 'Akses pengguna biasa ke fungsi admin ditolak oleh backend (403 Forbidden)');

    // T13: Mesin rusak dilaporkan
    const resT13 = await fetchJson('/conditions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        machineId: 'MC-000004',
        conditionType: ConditionType.DAMAGED,
        problemDescription: 'Pisau macet dan motor berasap'
      })
    });
    const mc4 = await repo.getMachineById('MC-000004');
    assert(resT13.status === 201 && mc4?.Current_Status === MachineStatus.UNDER_REPAIR && mc4?.Machine_Condition === MachineCondition.DAMAGED, 'T13', 'Laporan kerusakan mesin otomatis mengubah status mesin menjadi UNDER_REPAIR & DAMAGED');

    // T14: Mesin dinonaktifkan
    const resT14 = await fetchJson(`/machines/${newMachineId}/deactivate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const mcNew = await repo.getMachineById(newMachineId);
    assert(resT14.status === 200 && mcNew?.Active === false && mcNew?.Current_Status === MachineStatus.RETIRED, 'T14', 'Mesin dinonaktifkan berstatus Active=false dan Current_Status=RETIRED');

    // T15: Filter berdasarkan Line
    const resT15 = await fetchJson('/machines?line=Line%2002', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(resT15.status === 200 && resT15.body.data.every((m: any) => m.Location_Line === 'Line 02'), 'T15', 'Filter mesin berdasarkan Line menghasilkan data yang sesuai');

    // T16: Ekspor laporan CSV
    const resT16 = await fetchJson('/exports/machines', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(resT16.status === 200 && typeof resT16.body === 'string' && resT16.body.includes('Machine_ID') && resT16.body.includes('QR_Token'), 'T16', 'Ekspor CSV mesin menghasilkan format baku dengan header lengkap');

    // T18: QR yang sama dipindai berulang
    const scan1 = await fetchJson(`/qr/${encodeURIComponent(machineQrToken)}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const scan2 = await fetchJson(`/qr/${encodeURIComponent(machineQrToken)}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    assert(scan1.body.data.Machine_ID === scan2.body.data.Machine_ID && scan1.body.data.Machine_ID === 'MC-000001', 'T18', 'Pemindaian berulang token QR yang sama tetap konsisten merujuk ke mesin yang sama');

    console.log(`\n🎉 HASIL PENGUJIAN: ${testsPassed}/${totalTests} Skenario LULUS!`);
  } catch (err) {
    console.error('Pengujian gagal:', err);
  } finally {
    server.close();
  }
}

runTests().catch(console.error);