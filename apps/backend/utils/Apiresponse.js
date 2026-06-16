/**
 * ApiResponse
 * Standardizes every JSON response body so the frontend always gets
 * a predictable shape:
 *
 *  Success:  { success: true,  data: {...},  message: "..." }
 *  Error:    { success: false, errors: [...], message: "..." }
 *
 * Usage in a controller:
 *   res.status(200).json(ApiResponse.success(data, 'Plan fetched'));
 *   res.status(201).json(ApiResponse.created(data, 'User registered'));
 *   res.status(204).json(ApiResponse.noContent());
 */
class ApiResponse {
  /**
   * 200 OK — general success with data
   */
  static success(data = null, message = 'Success') {
    return { success: true, message, data };
  }

  /**
   * 201 Created — resource was created
   */
  static created(data = null, message = 'Created successfully') {
    return { success: true, message, data };
  }

  /**
   * 204 No Content — action succeeded, nothing to return
   * (pair with res.status(204).json(ApiResponse.noContent())
   *  or just res.status(204).end())
   */
  static noContent() {
    return { success: true, message: 'No content', data: null };
  }

  /**
   * Error shape — used by errorHandler middleware
   * @param {string} message
   * @param {Array}  errors  - optional array of field-level errors
   */
  static error(message = 'Something went wrong', errors = []) {
    return { success: false, message, errors };
  }

  /**
   * Paginated list — wraps an array with pagination metadata
   * @param {Array}  items
   * @param {number} total    - total matching rows in DB
   * @param {number} page     - current page (1-based)
   * @param {number} limit    - items per page
   * @param {string} message
   */
  static paginated(items, total, page, limit, message = 'Success') {
    return {
      success: true,
      message,
      data: items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }
}

module.exports = ApiResponse;