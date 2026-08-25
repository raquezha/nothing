import fs from "node:fs";
import path from "node:path";
import lockfile from "proper-lockfile";

const DEFAULT_LOCK_PATH = ".workflow/nochestra-writer.lock";
const writerReleases = new Map();

function lockOwnerPath(lockPath) {
	return `${lockPath}.owner.json`;
}

export async function acquireWriterLock(ownerId, lockPath = DEFAULT_LOCK_PATH, options = {}) {
	if (!ownerId) {
		throw new Error("ownerId is required to acquire writer lock");
	}
	if (writerReleases.has(lockPath)) {
		return false;
	}

	fs.mkdirSync(path.dirname(lockPath), { recursive: true });
	try {
		const release = await lockfile.lock(process.cwd(), {
			realpath: false,
			lockfilePath: lockPath,
			stale: options.stale ?? 30000,
			update: options.update ?? 15000,
			retries: options.retries ?? 0,
		});
		fs.writeFileSync(lockOwnerPath(lockPath), JSON.stringify({ owner: ownerId, acquiredAt: new Date().toISOString() }), "utf8");
		writerReleases.set(lockPath, { owner: ownerId, release });
		return true;
	} catch (e) {
		if (e?.code === "ELOCKED") {
			return false;
		}
		throw e;
	}
}

export async function releaseWriterLock(ownerId, lockPath = DEFAULT_LOCK_PATH) {
	if (!ownerId) {
		throw new Error("ownerId is required to release writer lock");
	}
	const held = writerReleases.get(lockPath);
	if (!held || held.owner !== ownerId) {
		return false;
	}
	await held.release();
	writerReleases.delete(lockPath);
	return true;
}

export function isWriterLocked(lockPath = DEFAULT_LOCK_PATH) {
	return fs.existsSync(lockPath);
}

export function resetWriterLock(lockPath = DEFAULT_LOCK_PATH) {
	writerReleases.delete(lockPath);
	fs.rmSync(lockPath, { recursive: true, force: true });
	fs.rmSync(lockOwnerPath(lockPath), { force: true });
}
