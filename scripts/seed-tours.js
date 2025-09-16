'use strict';

const fs = require('fs-extra');
const path = require('path');
const mime = require('mime-types');

async function seedTours() {
  const shouldImportSeedData = await isFirstRun();

  if (shouldImportSeedData) {
    try {
      console.log('Setting up tour data...');
      await importTourData();
      console.log('Tour data ready!');
    } catch (error) {
      console.log('Could not import tour data');
      console.error(error);
    }
  } else {
    console.log(
      'Tour data has already been imported. We cannot reimport unless you clear your database first.'
    );
  }
}

async function isFirstRun() {
  const pluginStore = strapi.store({
    environment: strapi.config.environment,
    type: 'type',
    name: 'setup',
  });
  const initHasRun = await pluginStore.get({ key: 'tourDataHasRun' });
  // Force import for testing
  return true;
}

async function setPublicPermissions(newPermissions) {
  // Find the ID of the public role
  const publicRole = await strapi.query('plugin::users-permissions.role').findOne({
    where: {
      type: 'public',
    },
  });

  // Create the new permissions and link them to the public role
  const allPermissionsToCreate = [];
  Object.keys(newPermissions).map((controller) => {
    const actions = newPermissions[controller];
    const permissionsToCreate = actions.map((action) => {
      return strapi.query('plugin::users-permissions.permission').create({
        data: {
          action: `api::${controller}.${controller}.${action}`,
          role: publicRole.id,
        },
      });
    });
    allPermissionsToCreate.push(...permissionsToCreate);
  });
  await Promise.all(allPermissionsToCreate);
}

function getFileSizeInBytes(filePath) {
  const stats = fs.statSync(filePath);
  const fileSizeInBytes = stats['size'];
  return fileSizeInBytes;
}

function getFileData(fileName) {
  const filePath = path.join('data', 'uploads', fileName);
  // Parse the file metadata
  const size = getFileSizeInBytes(filePath);
  const ext = fileName.split('.').pop();
  const mimeType = mime.lookup(ext || '') || '';

  return {
    filepath: filePath,
    originalFileName: fileName,
    size,
    mimetype: mimeType,
  };
}

async function uploadFile(file, name) {
  return strapi
    .plugin('upload')
    .service('upload')
    .upload({
      files: file,
      data: {
        fileInfo: {
          alternativeText: `An image uploaded to Strapi called ${name}`,
          caption: name,
          name,
        },
      },
    });
}

async function checkFileExistsBeforeUpload(files) {
  const existingFiles = [];
  const uploadedFiles = [];
  const filesCopy = [...files];

  for (const fileName of filesCopy) {
    // Check if the file already exists in Strapi
    const fileWhereName = await strapi.query('plugin::upload.file').findOne({
      where: {
        name: fileName.replace(/\..*$/, ''),
      },
    });

    if (fileWhereName) {
      // File exists, don't upload it
      existingFiles.push(fileWhereName);
    } else {
      // File doesn't exist, upload it
      const fileData = getFileData(fileName);
      const fileNameNoExtension = fileName.split('.').shift();
      const [file] = await uploadFile(fileData, fileNameNoExtension);
      uploadedFiles.push(file);
    }
  }
  const allFiles = [...existingFiles, ...uploadedFiles];
  // If only one file then return only that file
  return allFiles.length === 1 ? allFiles[0] : allFiles;
}

// Create an entry and attach files if there are any
async function createEntry({ model, entry }) {
  try {
    // Actually create the entry in Strapi
    const result = await strapi.documents(`api::${model}.${model}`).create({
      data: entry,
    });
    console.log(`Created ${model} entry:`, result.title || result.text || result.day || 'No title');
    return result;
  } catch (error) {
    console.error(`Error creating ${model} entry:`, error.message);
    console.error({ model, entry, error });
    throw error;
  }
}

async function importTours() {
  try {
    console.log('Starting tour import...');
    
    // Create "Run the Ranges" tour
    console.log('Uploading images for Run the Ranges tour...');
    const runTheRangesHero = await checkFileExistsBeforeUpload(['beautiful-picture.jpg']);
    const runTheRangesGallery = await checkFileExistsBeforeUpload([
      'coffee-art.jpg',
      'coffee-beans.jpg',
      'coffee-shadow.jpg'
    ]);

    console.log('Creating Run the Ranges tour...');
    const runTheRangesTour = await createEntry({
      model: 'tour',
      entry: {
        title: "Run the Ranges",
        slug: "run-the-ranges",
        location: "Mid Canterbury",
        duration: "3 days / 2 nights",
        groupSize: "8-14",
        difficulty: "Level 2",
        price: "from $995NZD",
        distance: "36-43km total",
        elevation: "850m+",
        status: "published",
        publishedAt: new Date().toISOString(),
        featured: true,
        showButton: true,
        showPrice: true,
        shortDescription: "• 3-Day Trail Running Escape\n• Level 2",
        description: "The Traverse team invites you deep into the Southern Alps for a three-day trail running adventure through some of New Zealand's most breathtaking alpine landscapes.\n\nExplore winding mountain trails and take in sweeping high country views at an easygoing pace. Each day brings fresh air, shared stories, and unforgettable moments topped off with the welcoming touch of Kiwi hospitality.\n\nThis trip isn't just about running - it's about connecting: to the land, to High Country life, and to a small, like-minded crew of runners. Just pack your trail gear - we'll take care of the rest.",
        heroImage: runTheRangesHero,
        galleryImages: runTheRangesGallery,
        metaTitle: "Run the Ranges - 3-Day Trail Running Adventure in Mid Canterbury",
        metaDescription: "Join Traverse for a 3-day trail running adventure in the Southern Alps. Experience breathtaking alpine landscapes, connect with like-minded runners, and enjoy authentic Kiwi hospitality.",
        publishedAt: new Date().toISOString(),
      },
    });

    // Get the created tour ID for relationships
    console.log('Finding created tour...');
    const createdTours = await strapi.documents('api::tour.tour').findMany({
      where: { slug: 'run-the-ranges' }
    });
    
    if (createdTours && createdTours.length > 0) {
      const tour = createdTours[0];
      console.log('Found tour, creating related content...');
      
      // Create tour highlights
      console.log('Creating tour highlights...');
      const highlights = [
        "Three-day trail running adventure in the Southern Alps",
        "Experience panoramic alpine views and mountain landscapes",
        "Connect with like-minded runners in small groups",
        "Enjoy authentic Kiwi hospitality in high-country station",
        "Discover winding mountain tracks and hidden trails"
      ];

      for (let i = 0; i < highlights.length; i++) {
        await createEntry({
          model: 'tour-highlight',
          entry: {
            tour: tour.id,
            text: highlights[i],
            order: i + 1,
            publishedAt: new Date().toISOString(),
          },
        });
      }

      // Create tour inclusions
      console.log('Creating tour inclusions...');
      const inclusions = [
        "2 nights twin or triple share accommodation with ensuite",
        "All meals included (except breakfast Day 1 and dinner Day 3)",
        "Guided runs with experienced trail leaders",
        "Group stretching session",
        "On-trail snacks and support"
      ];

      for (let i = 0; i < inclusions.length; i++) {
        await createEntry({
          model: 'tour-inclusion',
          entry: {
            tour: tour.id,
            text: inclusions[i],
            order: i + 1,
            publishedAt: new Date().toISOString(),
          },
        });
      }

      // Create tour itinerary
      console.log('Creating tour itinerary...');
      const itinerary = [
        {
          day: "Day 1 - Friday",
          description: "Meet at our high country base by 12pm for a welcome lunch and orientation with your Traverse hosts.",
          run: "8-10km - 150m+ elevation",
          meals: "Lunch, Dinner",
          order: 1
        },
        {
          day: "Day 2 - Saturday",
          description: "Full day of trail running through alpine landscapes with panoramic views.",
          run: "18-21km - 450m+ elevation",
          meals: "Breakfast, Lunch, Dinner",
          order: 2
        },
        {
          day: "Day 3 - Sunday",
          description: "Morning run followed by departure after lunch.",
          run: "10-12km - 250m+ elevation",
          meals: "Breakfast, Lunch",
          order: 3
        }
      ];

      for (const item of itinerary) {
        await createEntry({
          model: 'tour-itinerary',
          entry: {
            tour: tour.id,
            day: item.day,
            description: item.description,
            run: item.run,
            meals: item.meals,
            order: item.order,
            publishedAt: new Date().toISOString(),
          },
        });
      }
    } else {
      console.error('Could not find created tour!');
    }

    // Create "Ben Lomond and Beyond" tour (coming soon)
    console.log('Creating Ben Lomond and Beyond tour...');
    const benLomondHero = await checkFileExistsBeforeUpload(['what-s-inside-a-black-hole.jpg']);

    await createEntry({
      model: 'tour',
      entry: {
        title: "Ben Lomond and Beyond",
        slug: "ben-lomond-beyond",
        location: "Otago",
        duration: "3 days / 2 nights",
        groupSize: "8-14",
        difficulty: "Level 2",
        price: "from $1095NZD",
        distance: "TBA",
        elevation: "TBA",
        status: "coming_soon",
        featured: false,
        showButton: false,
        showPrice: false,
        shortDescription: "• 3-Day Trail Running Journey\n• Level 2\n\nCOMING SOON",
        description: "Coming soon - an exciting trail running adventure in the Otago region.",
        heroImage: benLomondHero,
        metaTitle: "Ben Lomond and Beyond - Coming Soon",
        metaDescription: "Coming soon - an exciting trail running adventure in the Otago region.",
        publishedAt: new Date().toISOString(),
      },
    });

    // Create "Ridge Runner" tour (coming soon)
    console.log('Creating Ridge Runner tour...');
    const ridgeRunnerHero = await checkFileExistsBeforeUpload(['the-internet-s-own-boy.jpg']);

    await createEntry({
      model: 'tour',
      entry: {
        title: "Ridge Runner",
        slug: "ridge-runner",
        location: "North Canterbury",
        duration: "2 days / 2 nights",
        groupSize: "8-14",
        difficulty: "Level 2",
        price: "from $1095NZD",
        distance: "TBA",
        elevation: "TBA",
        status: "coming_soon",
        featured: false,
        showButton: false,
        showPrice: false,
        shortDescription: "• 2-Night Trail Running Weekend\n• Level 2\n\nCOMING SOON",
        description: "Coming soon - a weekend trail running adventure in North Canterbury.",
        heroImage: ridgeRunnerHero,
        metaTitle: "Ridge Runner - Coming Soon",
        metaDescription: "Coming soon - a weekend trail running adventure in North Canterbury.",
        publishedAt: new Date().toISOString(),
      },
    });
    
    console.log('Tour import completed successfully!');
  } catch (error) {
    console.error('Error during tour import:', error);
    throw error;
  }
}

async function importTourData() {
  // Allow read of tour content types
  await setPublicPermissions({
    tour: ['find', 'findOne'],
    'tour-highlight': ['find', 'findOne'],
    'tour-inclusion': ['find', 'findOne'],
    'tour-itinerary': ['find', 'findOne'],
  });

  // Create all tour entries
  await importTours();
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();

  app.log.level = 'error';

  await seedTours();
  await app.destroy();

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
