import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import KPI from '@/models/KPI';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    // Fetch all KPIs from MongoDB
    const kpis = await KPI.find({}).sort({ order: 1, createdAt: 1 });
    
    return NextResponse.json({
      success: true,
      kpis: kpis
    });
  } catch (error) {
    console.error('Error fetching KPIs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch KPIs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    await connectDB();
    
    // Create new KPI in MongoDB
    const newKPI = new KPI({
      ...body,
      createdBy: body.createdBy || 'system', // You might want to get this from auth
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    const savedKPI = await newKPI.save();
    
    return NextResponse.json({
      success: true,
      message: 'KPI created successfully',
      kpi: savedKPI
    });
  } catch (error) {
    console.error('Error creating KPI:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create KPI' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'KPI ID is required' },
        { status: 400 }
      );
    }
    
    await connectDB();
    
    // Update KPI in MongoDB
    const updatedKPI = await KPI.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    
    if (!updatedKPI) {
      return NextResponse.json(
        { success: false, error: 'KPI not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'KPI updated successfully',
      kpi: updatedKPI
    });
  } catch (error) {
    console.error('Error updating KPI:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update KPI' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'KPI ID is required' },
        { status: 400 }
      );
    }
    
    await connectDB();
    
    // Delete KPI from MongoDB
    const deletedKPI = await KPI.findByIdAndDelete(id);
    
    if (!deletedKPI) {
      return NextResponse.json(
        { success: false, error: 'KPI not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'KPI deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting KPI:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete KPI' },
      { status: 500 }
    );
  }
}
