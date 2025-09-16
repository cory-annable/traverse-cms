'use strict';

async function setPublicPermissions(strapi, newPermissions) {
  const publicRole = await strapi.query('plugin::users-permissions.role').findOne({
    where: { type: 'public' },
  });

  const allPermissionsToCreate = [];
  Object.keys(newPermissions).forEach((controller) => {
    const actions = newPermissions[controller];
    actions.forEach((action) => {
      allPermissionsToCreate.push(
        strapi.query('plugin::users-permissions.permission').create({
          data: {
            action: `api::${controller}.${controller}.${action}`,
            role: publicRole.id,
          },
        })
      );
    });
  });

  await Promise.all(allPermissionsToCreate);
}

module.exports = { setPublicPermissions };


