import Game from "@/components/game";

const Home = () => {
  return (
    <div className="flex justify-center bg-black">
      <div>
        <h1 className="text-white text-center text-5xl">Air Hockey!</h1>
        <Game />

        <p className="text-white">very cool game!</p>
      </div>
    </div>
  );
};

export default Home;
