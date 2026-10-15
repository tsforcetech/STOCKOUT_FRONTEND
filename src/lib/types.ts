export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  userId?: string;
  displayName?: string;
  mfaRequired?: boolean;
  mfaChallengeToken?: string;
}
export interface SellerContext {
  sellerId: string;
  displayName: string;
  sellerType: string;
  status: string;
  verificationStatus: string;
  onboardingStatus: string;
  isOwner: boolean;
}
export interface Actor {
  userId: string;
  sellerContexts: SellerContext[];
}
export interface Seller {
  sellerId: string;
  organizationType: string;
  email: string;
  legalName?: string;
  displayName: string;
  registrationNo?: string;
  countryCode: string;
  defaultCurrency: string;
  status: string;
  verificationStatus: string;
  onboardingStatus: string;
  rowVersion: string;
}
export interface SellerDocument {
  sellerDocumentId: string;
  fileAssetId: string;
  documentType: string;
  documentNumber?: string;
  expiresAt?: string;
  verificationStatus: string;
  createdAtUtc: string;
}
export interface Category {
  categoryId: string;
  name: string;
  children?: Category[];
}
export interface Option {
  value: string;
  label: string;
}
export interface AttributeDefinition {
  attributeDefinitionId: string;
  name: string;
  label?: string;
  code: string;
  dataType: string;
  isRequired: boolean;
  isMultiValued?: boolean;
  options?: { value: string; label?: string; displayName?: string }[];
  minValue?: number;
  maxValue?: number;
  maxLength?: number;
}
export interface Requirements {
  categoryId: string;
  attributes: AttributeDefinition[];
  brands: { brandId: string; name: string; brandName?: string }[];
  unitRules: { defaultUnitId?: string; units: { unitId: string; name: string; symbol: string }[] };
  conditionRules: {
    conditions: {
      conditionId: string;
      name: string;
      conditionName?: string;
      grades?: { gradeId: string; name: string; gradeName?: string }[];
    }[];
  };
}
export interface ListingVersion {
  listingVersionId: string;
  versionNumber: number;
  categoryId: string;
  title: string;
  description?: string;
  pricingMode: string;
  currency: string;
  basePrice: number;
  brandId?: string;
  conditionId?: string;
  gradeId?: string;
  quantityUnitId?: string;
  location?: { countryCode: string; stateOrEmirate: string; city: string };
}
export interface Listing {
  listingId: string;
  sellerId: string;
  status: string;
  title?: string;
  categoryId?: string;
  createdAtUtc?: string;
  updatedAtUtc?: string;
  rowVersion: string;
  currentDraftVersionId?: string;
  publishedVersionId?: string;
  currentDraftVersion?: ListingVersion;
  publishedVersion?: ListingVersion;
  expiresAtUtc?: string;
}
export interface ListingPage {
  items: Listing[];
  totalCount: number;
}
export interface MediaItem {
  fileAssetId: string;
  mediaType: string;
  displayOrder: number;
  isPrimary: boolean;
  documentType?: string;
}
export interface MediaResponse {
  listingId: string;
  listingVersionId: string;
  rowVersion: string;
  media: MediaItem[];
}
export interface AttributeValues {
  rowVersion: string;
  attributes: { attributeDefinitionId: string; dataType: string; values: string[] }[];
}
export interface Inventory {
  listingId: string;
  onHandQuantity: number;
  reservedQuantity: number;
  sellableQuantity: number;
  rowVersion: string | null;
}
export interface Movement {
  movementId: string;
  movementType: string;
  onHandQuantityDelta: number;
  onHandQuantityAfter: number;
  reservedQuantityAfter: number;
  reasonCode?: string;
  notes?: string;
  createdAtUtc: string;
}
export interface Inspection {
  inspectionId: string;
  inspectionNo: string;
  listingId: string;
  status: string;
  result?: string;
  summary?: string;
  failureNotes?: string;
  createdAtUtc: string;
  completedAtUtc?: string;
  responses?: {
    inspectionResponseId: string;
    itemLabelSnapshot: string;
    itemResult?: string;
    textValue?: string;
    numberValue?: number;
    passFailValue?: string;
    inspectorNotes?: string;
  }[];
  evidence?: { fileAssetId: string; description?: string; downloadUrl?: string }[];
}
export interface Moderation {
  status: string;
  decision?: string;
  reasonCode?: string;
  sellerNotes?: string;
  reviewedAtUtc?: string;
}
export interface Validation {
  isValid: boolean;
  errors: { field: string; code: string; message: string }[];
}
export interface Profile {
  displayName: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  mobile?: string;
  preferredLocale?: string;
  timeZone?: string;
  profileImageAssetId?: string;
}
export interface Session {
  sessionId: string;
  status: string;
  createdAtUtc: string;
  isCurrentSession: boolean;
  deviceLabel?: string;
  ipAddress?: string;
}
