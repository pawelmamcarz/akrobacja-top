import { type Env } from '../../../src/lib/types';
import { checkAdminAuth } from '../../../src/lib/admin-auth';

// GET /api/admin/courses
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  if (!checkAdminAuth(ctx.request, ctx.env)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { results } = await ctx.env.DB.prepare(
    'SELECT * FROM courses ORDER BY created_at DESC'
  ).all();

  return Response.json({ courses: results });
};

// POST /api/admin/courses — create or update course
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!checkAdminAuth(ctx.request, ctx.env)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await ctx.request.json()) as {
    action: string;
    course_id?: string;
    customer_name?: string;
    customer_email?: string;
    customer_phone?: string;
    license_number?: string;
    total_flights?: number;
    amount?: number;
    notes?: string;
  };

  switch (body.action) {
    case 'create': {
      if (!body.customer_name || !body.customer_email) {
        return Response.json({ error: 'Brak danych kursanta' }, { status: 400 });
      }
      const courseId = crypto.randomUUID();
      await ctx.env.DB.prepare(`
        INSERT INTO courses (id, customer_name, customer_email, customer_phone, license_number, total_flights, amount, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        courseId, body.customer_name, body.customer_email,
        body.customer_phone || null, body.license_number || null,
        body.total_flights || 16, body.amount || 2222200,
        body.notes || null,
      ).run();
      return Response.json({ ok: true, course_id: courseId });
    }

    case 'complete_flight': {
      if (!body.course_id) return Response.json({ error: 'Brak course_id' }, { status: 400 });
      await ctx.env.DB.prepare(
        'UPDATE courses SET completed_flights = completed_flights + 1 WHERE id = ?'
      ).bind(body.course_id).run();

      const course = await ctx.env.DB.prepare(
        'SELECT completed_flights, total_flights FROM courses WHERE id = ?'
      ).bind(body.course_id).first<{ completed_flights: number; total_flights: number }>();

      if (course && course.completed_flights >= course.total_flights) {
        await ctx.env.DB.prepare(
          "UPDATE courses SET status = 'completed' WHERE id = ?"
        ).bind(body.course_id).run();
      }

      return Response.json({ ok: true, completed: course?.completed_flights, total: course?.total_flights });
    }

    case 'cancel': {
      if (!body.course_id) return Response.json({ error: 'Brak course_id' }, { status: 400 });
      await ctx.env.DB.prepare(
        "UPDATE courses SET status = 'cancelled' WHERE id = ?"
      ).bind(body.course_id).run();
      return Response.json({ ok: true, message: 'Kurs anulowany' });
    }

    default:
      return Response.json({ error: 'Nieznana akcja' }, { status: 400 });
  }
};
