import mongoose from 'mongoose';

const latexFileSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  content: {
    type: String,
    required: true,
  },
  sourceProjectId: {
    type: String,
    required: false,
  },
  processMetadata: {
    processName: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    processOwner: {
      type: String,
      default: '',
    },
    processManager: {
      type: String,
      default: '',
    },
  },
  additionalDetails: {
    versionNo: {
      type: String,
      default: '',
    },
    processStatus: {
      type: String,
      default: '',
    },
    classification: {
      type: String,
      default: '',
    },
    dateOfCreation: {
      type: String,
      default: '',
    },
    dateOfReview: {
      type: String,
      default: '',
    },
    effectiveDate: {
      type: String,
      default: '',
    },
    modificationDate: {
      type: String,
      default: '',
    },
    modifiedBy: {
      type: String,
      default: '',
    },
    changeDescription: {
      type: String,
      default: '',
    },
    createdBy: {
      type: String,
      default: '',
    },
  },
  selectedTables: {
    type: [String],
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

latexFileSchema.pre('save', function (next) {
  // @ts-ignore - this refers to the document instance
  this.updatedAt = new Date();
  next();
});

const LatexFile = mongoose.models.LatexFile || mongoose.model('LatexFile', latexFileSchema);

export default LatexFile;


