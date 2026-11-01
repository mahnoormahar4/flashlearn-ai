export interface SampleLesson {
  id: string;
  title: string;
  description: string;
  text: string;
}

export const SAMPLE_LESSONS: SampleLesson[] = [
  {
    id: 'science-states-of-matter',
    title: 'States of Matter (Sample Lesson)',
    description: 'Sample science lesson covering solids, liquids, and gases.',
    text: `Matter is anything that has mass and occupies space. Matter exists in three main physical states: solid, liquid, and gas. Everything around us, including books, water, and the air we breathe, is made of tiny particles.

In solids, the particles are packed very tightly in an orderly pattern with very strong attractive forces between them. The particles cannot move freely; they can only vibrate in their fixed positions. Because of this tight arrangement, solids have a definite shape and a fixed volume. A stone, a wooden table, or an ice cube does not change its shape on its own.

In liquids, the particles are close together, but they are not held in fixed positions. The attractive forces between liquid particles are weaker than in solids, allowing them to slide past each other. Therefore, liquids have a definite volume, but they do not have a fixed shape. A liquid takes the shape of the container it is placed in, such as water poured into a glass or a jug.

In gases, the particles are very far apart from one another and move randomly at high speeds in all directions. The attractive forces between gas particles are extremely weak. Because of this large spacing, gases have neither a fixed shape nor a definite volume. They expand to completely fill whatever container or room they are in, like air inside a balloon or steam in a kettle.`,
  },
  {
    id: 'history-indus-valley',
    title: 'Indus Valley Civilization (History Sample)',
    description: 'Sample history lesson covering ancient cities and trade.',
    text: `The Indus Valley Civilization was one of the world's earliest major urban societies, flourishing around 2500 BCE along the Indus River basin. Its two most famous planned cities were Harappa and Mohenjo-Daro, featuring grid-like brick streets, wells, and advanced covered drainage systems. The people of the Indus Valley cultivated wheat, barley, and cotton, and they developed skilled crafts in bronze, pottery, and stone seals. They engaged in extensive sea and overland trade with ancient Mesopotamia and Persian Gulf regions.`,
  },
];
