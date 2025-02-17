export enum Tables {
  ANNOUNCEMENTS = "announcements",
  ENV = "env",
  EVENTS = "events",
  EDIT_LOGS = "edit_logs",
  ORDERS = "orders",
  PHOTOS = "photos",
  PRODUCT_VARIATIONS = "product_variations",
  PRODUCTS = "products",
  RESET_TOKENS = "reset_tokens",
  LOGIN_LOGS = "login_logs",
  STUDENTS = "students",
  TUTORIALS = "tutorials",
  VARIATIONS = "variations",
  NON_BSCS_ORDERS = "non_bscs_orders",
  GCASH_UPLOADS = "gcash_uploads",
}

export enum AnnouncementColumns {
  ID = "id",
  ADMIN_STUDENT_ID = "admin_student_id",
  TITLE = "title",
  CONTENT = "content",
  PHOTOS_ID = "photos_id",
  DATE_STAMP = "date_stamp",
}

export enum EnvColumns {
  ID = "id",
  KEY = "key",
  VALUE = "value",
  DATE_STAMP = "date_stamp",
}

export enum EditLogColumns {
  ID = "id",
  ADMIN_ID = "admin_id",
  METHOD = "method",
  TABLE = "table",
  BEFORE = "before",
  AFTER = "after",
  DATE_STAMP = "date_stamp",
}

export enum EventColumns {
  ID = "id",
  THUMBNAIL = "thumbnail",
  TITLE = "title",
  DESCRIPTION = "description",
  DATE = "date",
  START_TIME = "start_time",
  END_TIME = "end_time",
  VENUE = "venue",
  DATE_STAMP = "date_stamp",
}

export enum OrderColumns {
  ID = "id",
  REFERENCE = "reference",
  UNIQUE_ID = "unique_id",
  STUDENT_ID = "student_id",
  PRODUCTS_ID = "products_id",
  VARIATIONS_ID = "variations_id",
  QUANTITY = "quantity",
  MODE_OF_PAYMENT = "mode_of_payment",
  STATUS = "status",
  USER_REMARKS = "user_remarks",
  ADMIN_REMARKS = "admin_remarks",
  STATUS_UPDATED = "status_updated",
  EDIT_DATE = "edit_date",
  DATE_STAMP = "date_stamp"
}

export enum NonBscsOrderColumns {
  ID = "id",
  REFERENCE = "reference",
  UNIQUE_ID = "unique_id",
  PRODUCTS_ID = "products_id",
  VARIATIONS_ID = "variations_id",
  QUANTITY = "quantity",
  MODE_OF_PAYMENT = "mode_of_payment",
  STUDENT_ID = "student_id",
  FIRST_NAME = "first_name",
  LAST_NAME = "last_name",
  EMAIL = "email",
  COURSE = "course",
  YEAR_LEVEL = "year_level",
  STATUS = "status",
  USER_REMARKS = "user_remarks",
  ADMIN_REMARKS = "admin_remarks",
  STATUS_UPDATED = "status_updated",
  EDIT_DATE = "edit_date",
  DATE_STAMP = "date_stamp"
}

export enum PhotoColumns {
  ID = "id",
  NAME = "name",
  DATA = "data",
  TYPE = "type",
  DATE_STAMP = "date_stamp",
}

export enum GcashUploadsColumns {
  ID = "id",
  REFERENCE = "reference",
  NAME = "name",
  DATA = "data",
  TYPE = "type",
  DATE_STAMP = "date_stamp",
}

export enum ProductVariationColumns {
  ID = "id",
  PRODUCTS_ID = "products_id",
  VARIATIONS_ID = "variations_id",
  STOCK = "stock",
  PHOTOS_ID = "photos_id",
}

export enum ProductColumns {
  ID = "id",
  NAME = "name",
  THUMBNAIL = "thumbnail",
  DESCRIPTION = "description",
  LIKES = "likes",
  STOCK = "stock",
  PRICE = "price",
  MAX_QUANTITY = "max_quantity",
  IS_AVAILABLE = "is_available",
  DATE_STAMP = "date_stamp",
}

export enum ResetTokenColummns {
  ID = "id",
  STUDENTS_ID = "students_id",
  TOKEN = "token",
  IS_USED = "is_used",
  RESET_DATE_STAMP = "reset_date_stamp",
  DATE_STAMP = "date_stamp",
}

export enum StudentColumns {
  ID = "id",
  STUDENT_ID = "student_id",
  LAST_NAME = "last_name",
  FIRST_NAME = "first_name",
  YEAR_LEVEL = "year_level",
  EMAIL_ADDRESS = "email_address",
  PASSWORD = "password",
  DATE_STAMP = "date_stamp",
};

export enum TutorialColumns {
  ID = "id",
  STUDENT_ID = "student_id",
  LANGUAGE = "language",
  SCHEDULE = "schedule",
  STATUS = "status",
  STATUS_DATE_STAMP = "status_date_stamp",
  REMARKS = "remarks",
  DATE_STAMP = "date_stamp"
}

export enum VariationColumns {
  ID = "id",
  NAME = "name"
}