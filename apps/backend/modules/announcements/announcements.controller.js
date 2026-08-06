const service = require('./announcements.service');
const asyncHandler = require('../../utils/Asynchandler');
const ApiResponse = require('../../utils/Apiresponse');

const listAdminAnnouncements = asyncHandler(async (req, res) => {
  const announcements = await service.listAnnouncementHistory();
  res.json(ApiResponse.success(announcements));
});

const createAdminAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await service.createAnnouncement(req.user, req.body);
  res.status(201).json(
    ApiResponse.created(announcement, 'Announcement published successfully')
  );
});

module.exports = {
  listAdminAnnouncements,
  createAdminAnnouncement,
};
