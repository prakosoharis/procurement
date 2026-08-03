import { actor, body, error, json } from '../../../../lib/api/governance';
import { createPersonProfile, listPeopleProfiles } from '../../../../lib/people/profile-service';

export async function GET(request) {
  try { return json(await listPeopleProfiles(await actor(), { query: new URL(request.url).searchParams.get('q') || '' })); }
  catch (exception) { return error(exception); }
}

export async function POST(request) {
  try { return json(await createPersonProfile(await actor(), await body(request)), 201); }
  catch (exception) { return error(exception); }
}
