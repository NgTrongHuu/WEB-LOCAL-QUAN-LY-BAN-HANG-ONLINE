/**
 * lib/pagination.js
 * Chuẩn hóa an toàn cho page/pageSize - KHÔNG dùng pattern
 * `Math.min(Number(x) || default, max)` vì nó không chặn được số âm
 * (Number(-5) || 50 === -5 vì -5 là truthy trong JS).
 */
function parsePagination(query = {}, { defaultPageSize = 50, maxPageSize = 100 } = {}) {
  let page = Number(query.page);
  let pageSize = Number(query.pageSize);

  if (!Number.isFinite(page) || page < 1) page = 1;
  else page = Math.floor(page);

  if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = defaultPageSize;
  else pageSize = Math.floor(pageSize);

  if (pageSize > maxPageSize) pageSize = maxPageSize;

  return { page, pageSize, offset: (page - 1) * pageSize };
}

module.exports = { parsePagination };
