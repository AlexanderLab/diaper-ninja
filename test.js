import { extractCountFromTitle } from './diapers.js';

const testCases = [
  {
    title: "Dodot Bebé Seco Pañales Talla 4, 192 Pañales, Con Canales De Aire, Bebés 9-14 kg",
    expected: 192
  },
  {
    title: "LILLYDOO Pañales Ecológicos, Talla 3 (4-9kg) | Pack de 124 pañales | Hipoalergénicos",
    expected: 124
  },
  {
    title: "Pampers Baby-Dry Size 4, 174 Diapers, Gigapack, Unisex",
    expected: 174
  },
  {
    title: "Dodot Sensitive Pañales Talla 2 (4-8 kg), 240 Pañales, Con Tubos Ultra-Absorbentes",
    expected: 240
  },
  {
    title: "Huggies Ultra Comfort Pañales Talla 3 (4-9 kg) - 150 pañales",
    expected: 150
  },
  {
    title: "Chelino Fashion Love Talla 3, 144 unidades",
    expected: 144
  },
  {
    title: "Dodot Bebé Seco Pañales Talla 5, 120 uds, Blanco",
    expected: 120
  },
  {
    title: "Amazon Brand - Mama Bear Pañales ultra secos, Talla 6 (15+ kg), 80 u. (Pack de 2 x 40)",
    expected: 80
  },
  {
    title: "Nido capazo bebe - Nido colecho",
    expected: 1
  }
];

let successCount = 0;
for (const tc of testCases) {
  const result = extractCountFromTitle(tc.title);
  if (result === tc.expected) {
    console.log(`✅ [PASS] "${tc.title.slice(0, 40)}..." -> Extracted: ${result}`);
    successCount++;
  } else {
    console.error(`❌ [FAIL] "${tc.title.slice(0, 40)}..." -> Expected: ${tc.expected}, Got: ${result}`);
  }
}

console.log(`\nTests results: ${successCount}/${testCases.length} passed.`);
if (successCount === testCases.length) {
  console.log("All unit tests passed successfully!");
  process.exit(0);
} else {
  console.error("Some unit tests failed!");
  process.exit(1);
}