const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const keyPath = path.join(process.env.USERPROFILE, 'Downloads', 'sistema-de-ventas-milam-firebase-adminsdk-fbsvc-1aa8f02017.json');
const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function main() {
  const action = process.argv[2];

  if (action === 'list') {
    const snap = await db.collection('products').orderBy('name').get();
    console.log('=== TODOS LOS PRODUCTOS EN FIREBASE ===');
    console.log('Total:', snap.size);
    console.log('');
    for (const d of snap.docs) {
      const p = d.data();
      const hasLevels = p.saleLevels && p.saleLevels.length > 0;
      console.log(`ID: ${d.id}`);
      console.log(`  Nombre: ${p.name || 'SIN NOMBRE'}`);
      console.log(`  Type: ${p.type}`);
      console.log(`  Stock: ${p.stock}`);
      console.log(`  Niveles: ${hasLevels ? p.saleLevels.length + ' niveles' : 'ninguno'}`);
      if (hasLevels) {
        console.log(`  Niveles detalle: ${p.saleLevels.map(l => `${l.name} (stock:${l.stock})`).join(', ')}`);
      }
      console.log('');
    }

  } else if (action === 'restore') {
    const idsArg = process.argv[3];
    if (!idsArg) { console.log('Uso: node _restaurar.js restore "id1,id2,id3" "unidad"'); return; }
    const typeArg = process.argv[4] || 'unidad';
    const ids = idsArg.split(',').map(s => s.trim());
    const stockMap = {};
    if (process.argv[5]) {
      process.argv[5].split(',').forEach(pair => {
        const [id, stock] = pair.split(':');
        if (id && stock) stockMap[id.trim()] = parseInt(stock);
      });
    }
    const batch = db.batch();
    for (const id of ids) {
      const ref = db.collection('products').doc(id);
      const update = { type: typeArg };
      if (stockMap[id] !== undefined) update.stock = stockMap[id];
      batch.update(ref, update);
      console.log(`  Marcado para restaurar: ${id} → type: ${typeArg}${stockMap[id] !== undefined ? `, stock: ${stockMap[id]}` : ''}`);
    }
    await batch.commit();
    console.log('✅ Restauración completada');

  } else {
    console.log('Comandos:');
    console.log('  node _restaurar.js list                    — Lista todos los productos');
    console.log('  node _restaurar.js restore "id1,id2" "unidad" — Restaura tipos a un conjunto de productos');
    console.log('  node _restaurar.js restore "id1,id2" "unidad" "id1:100,id2:50" — Restaura tipos y stocks específicos');
  }

  await admin.app().delete();
}

main().catch(e => { console.error('ERROR:', e); process.exit(1); });
