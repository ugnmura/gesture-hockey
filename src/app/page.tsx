import Game from "@/components/game";

const Home = () => {
  return (
    <div className="flex justify-center bg-black">
      <div className="p-8 space-y-8">
        <h1 className="text-white text-center text-5xl">Air Hockey!</h1>
        <Game />

        <section id="how" className="mx-auto max-w-3xl px-4 py-10">
          <h2 className="text-white mb-3 text-2xl font-semibold">
            How to play
          </h2>
          <ol className="list-decimal space-y-2 pl-6 text-slate-200">
            <li>
              Enable camera access when prompted. The game detects both players'
              hands using the live video feed.
            </li>
            <li>
              Two players should stand or sit on opposite sides of the screen
              Each player controls a paddle using their hands.
            </li>
            <li>
              Keep both hands visible to the camera. Move your hands forward,
              backward, and sideways to hit the puck and defend your goal.
            </li>
            <li>The first player to 10 points wins the match.</li>
            <li>
              For best tracking: use good lighting, avoid fast sudden movements,
              and keep the background simple.
            </li>
          </ol>
        </section>
      </div>
    </div>
  );
};

export default Home;
