import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import LatexFile from '@/models/LatexFile';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    await connectDB();

    const files = await LatexFile.find({ userId }).sort({ updatedAt: -1 }).lean();
    return NextResponse.json({ files });
  } catch (error) {
    console.error('Error in GET /api/latexfiles:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId,
      name,
      content,
      sourceProjectId,
      processMetadata,
      additionalDetails,
      selectedTables,
    } = body;

    if (!userId || !name || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await connectDB();

    const file = await LatexFile.create({
      userId,
      name,
      content,
      sourceProjectId,
      processMetadata: processMetadata || {},
      additionalDetails: additionalDetails || {},
      selectedTables: Array.isArray(selectedTables) ? selectedTables : [],
    });

    return NextResponse.json({ file });
  } catch (error) {
    console.error('Error in POST /api/latexfiles:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileId, name } = body;

    if (!fileId || !name) {
      return NextResponse.json({ error: 'Missing fileId or name' }, { status: 400 });
    }

    await connectDB();

    const updated = await LatexFile.findByIdAndUpdate(
      fileId,
      { name, updatedAt: new Date() },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    return NextResponse.json({ file: updated });
  } catch (error) {
    console.error('Error in PUT /api/latexfiles:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json({ error: 'Missing fileId' }, { status: 400 });
    }

    await connectDB();

    // Try by _id first, then by any other identifier field if needed
    const isObjectId = mongoose.Types.ObjectId.isValid(fileId);
    const query = isObjectId ? { _id: fileId } : { _id: fileId };

    const deleted = await LatexFile.findOneAndDelete(query);
    if (!deleted) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/latexfiles:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


