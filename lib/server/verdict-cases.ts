/** Cases for the real-model check (scripts/gibberish-check.mts and the preview-only /api/selfcheck). */
// Every objective Raj has typed, plus common mash shapes.
export const MASH = [
  "sualskdlasjfljsdlkfjslfjslkfls", "dfgadgargafsgad", "adfgadfgadfgasfgsa", "aklsdjalksd alksdj", "asdasdasd", "qwerty uiop",
  "blah blah blah", "gadfgadfg", "fgafgadga sdgadg", "hasgdhasgd", "sdfkjhsdf lkjhlkj", "jfjfjfjfjf", "hdhdhd hdhdh",
  "lorem ipsum dolor", "xcvxcv bnmbnm", "ghfjdk", "adsfadsf", "werwer", "kjashd kjahsd", "poiupoiu", "zzzzzz", "dfgerg sdfgsd",
];
// Terse real objectives with no common word: these are the false-positive risk.
export const REAL = [
  "Kubernetes autoscaling", "GDPR checklist", "Kafka consumer lag", "Szczecin itinerary", "Wedding speech", "xkcd style comic",
  "Grpc vs REST", "Fjord cruise itinerary", "Rijksmuseum tickets", "Pnpm monorepo", "Wkhtmltopdf alternatives", "Quarterly OKRs",
  "Bewerbungsschreiben Softwareentwickler", "Rezept Lasagne vegetarisch", "Resumen ejecutivo informe", "Hvac quote comparison",
  "Djokovic biography", "Pitch deck outline", "Liberty bell history", "Instagram captions",
];
// Optional fields, judged next to a real objective. Raj's three from 16 Nov first.
export const FIELD_MASH = ["asdgasdgasd", "sadgasgasgd", "asdgasgasdg", "fgsdfg", "dfgerg", "hfdgsd kjgh", "gadfg sfgd", "wefwef", "sdfsdf"];
export const FIELD_REAL = [
  "founders", "formal", "Series A investors", "B2B SaaS buyers", "markdown table", "Q3 board", "Kubernetes operators", "punchy",
  "one-pager", "CFO", "Gen Z", "warm but direct", "Notion doc",
];

export const FIELD_OBJECTIVE = "Pitch deck outline for our seed round";
